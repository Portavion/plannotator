{
  description = "Plannotator development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bash
            bun
            git
            gh
            nodejs_24
            ripgrep
          ];

          shellHook = ''
            export BUN_INSTALL="$PWD/.bun"
            export PATH="$BUN_INSTALL/bin:$PATH"
          '';
        };
      }
    );
}
