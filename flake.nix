{
  description = "@ailo/koa-logger-middleware";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = inputs@{ self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        # Get the app name from the package.json
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        projectName = packageJson.name;
        # Replace the version in package.json so we don't invalidate the node_modules cache.
        packageJsonPinned = builtins.toFile "package.json" (builtins.toJSON (packageJson // { version = "1.0.0"; }));

        # Overlays allow redefining the values in pkgs.
        # In this case we can change "nodejs" to refer to a specific version of node.
        # When updating node please run `yarn` locally to check the packages are compaible before pushing.
        myOverlays = [ (self: super: { nodejs = super.nodejs-16_x; }) ];
        myConfig.permittedInsecurePackages = [ "nodejs-16.20.2" ];

        pkgsNative = (import nixpkgs) {
          system = system;
          overlays = myOverlays;
          config = myConfig;
        };

        allowedPathsRegex = [
          "^src$"
          "^src/.*"
          "^yarn.lock$"
          "^.eslintignore$"
          "^.prettierignore$"
          "^.npmignore$"
          "^.prettierrc$"
          "^.babelrc$"
          "^(.*).ts$"
          "^(.*).js$"
          "^(.*).json"
          "^.jest$"
          "^.jest/.*$"
        ];

        srcFiles = pkgsNative.lib.sourceByRegex ./. allowedPathsRegex;

        # Replace any private repo URLs with our internal proxy that does not require the NPM_TOKEN
        yarnLock = builtins.toFile "yarn.lock" (builtins.replaceStrings [ "https://registry.yarnpkg.com/@ailo" ] [ "https://npm-cache.dev.ailo.io/@ailo" ] (builtins.readFile ./yarn.lock));

        # This function takes the yarn.lock file and generates a nix file that downloads all the files.
        yarnNixFunc = pkgsNative.yarn2nix-moretea.mkYarnNix { inherit yarnLock; };
        # eval() the nix code, this will return a directory with a bunch of tgz files.
        offlineCache = (pkgsNative.callPackage yarnNixFunc { }).offline_cache;
        nodeModules = pkgsNative.stdenv.mkDerivation {
          name = "node_modules";
          phases = [ "buildPhase" ];
          nativeBuildInputs = with pkgsNative; [ yarn nodejs yarn2nix-moretea.fixup_yarn_lock ];
          buildPhase = ''
            # Yarn writes cache directories etc to $HOME.
            export HOME=$PWD/yarn_home
            cp ${packageJsonPinned} ./package.json
            cp ${yarnLock} ./yarn.lock
            chmod +w yarn.lock
            cat package.json

            # Set yarn to use the cache we downloaded.
            yarn config --offline set yarn-offline-mirror ${offlineCache}
            # replace the URLs in the lock file with the same file names that are in the offlineCache
            fixup_yarn_lock yarn.lock

            # Run yarn install, this will use the tgz files in the cache and make node_modules
            time yarn install --offline --ignore-scripts

            # Remove any large tarballs that were published into NPM by accident
            find . -type f -name "*.tar" -size +100M -delete
            find . -type f -name "*.gz" -size +100M -delete

            # Move the development dependencies to $out. Also fix any #!/bin/bash stuff.
            mkdir -p $out
            mv node_modules $out/
            patchShebangs $out
          '';
        };

        # Get yarn to package the library into a tarball.
        compiledProject = pkgsNative.stdenv.mkDerivation {
          name = projectName;

          # The source directory with only the matching files present.
          src = srcFiles;

          buildInputs = with pkgsNative; [ yarn ];
          buildPhase = ''
            export HOME="$PWD/home"
            export CI=true
            ln -s ${nodeModules}/node_modules node_modules
            yarn --offline lint
            yarn --offline test
            yarn --offline build
            mkdir -p $out
            mv build package.json $out/
          '';
        };

        # ailo-npm-publish is defined in the Builkite agent,
        # https://github.com/ailohq/buildkite-nix-agents/blob/master/configuration.nix
        publishNpm = pkgsNative.writeShellApplication {
          name = "npm-publish";
          text = "ailo-npm-publish --directory ${compiledProject}";
        };
      in
      {
        # to use direnv, make a file named `.envrc` containing `use flake`
        devShell = pkgsNative.mkShell {
          buildInputs = with pkgsNative; [
            nodejs
            yarn
          ];

          shellHook = ''
            if [ -d .idea ]; then
              echo "If using IntelliJ, set it to use node and yarn in the $PWD/.idea directory, this ensures your are using the same version as prod."
              ln -sfn ${pkgsNative.nodejs} .idea/nodejs
              ln -sfn ${pkgsNative.yarn} .idea/yarn
            fi
          '';
        };

        # The actual outputs, use `nix flake show` to view.
        packages = {
          npm-publish = publishNpm;
          default = compiledProject;
        };
      });
}
