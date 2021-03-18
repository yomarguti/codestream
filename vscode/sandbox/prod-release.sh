
# Used for the production asset build
export VSCSB_ASSET_ENV=prod
[ -f $HOME/.codestream/eclipse/openvsx.sh ] && . $HOME/.codestream/eclipse/openvsx.sh && export OPENVSX_PUBLISH_TOKEN
. $VSCSB_TOP/sandbox/defaults.sh
unset VSCSB_NOPUBLISH
