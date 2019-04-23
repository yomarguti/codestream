
# This file contains all the default variable settings for the sandbox.
# These settings should work on every developer's machine upon installation.

# There are 3 sandbox related variables that are pre-defined prior to
# sourcing in this file. They are:
#
#  ATOM_NAME     Name of the installed sandbox (installation specific)
#  ATOM_TOP      Path up to and including the sandbox's primary git project
#         (eg. this file is ATOM_TOP/sandbox/defaults.sh)
#  ATOM_SANDBOX  Path to the root directory of the sandbox tree


# Installation options
# --------------------
# You can override a sandbox's configuration variables by placing
# 'VARIABLE=VALUE' assignments into $MY_SANDBOX/sb.options.  These
# settings will override any others specified in the sandbox config.
# Each row is stricly a KEY=VALUE assignment. Do not write shell
# code. Use a ash (#) for comments.

if [ -f "$ATOM_SANDBOX/sb.options" ]; then
	echo "Loading extra params from sb.options"
	. $ATOM_SANDBOX/sb.options
	export `grep ^ATOM_ $ATOM_SANDBOX/sb.options|cut -f1 -d=`
fi


# ------------- Yarn --------------
# Uncomment and setup if yarn is required. Available versions can be seen
# with the command:
#   ssh $DT_CLOUD_SERVER ls /home/web/SandboxRepos/software/yarn-$DT_OS_TYPE-*
# export ATOM_YARN=true
# export ATOM_YARN_VER=latest
# export PATH=$ATOM_SANDBOX/yarn/bin:$PATH


# ------------- Node --------------
# Uncomment and setup if node is required. Available versions can be seen
# with the command:
#   ssh $DT_CLOUD_SERVER ls /home/web/SandboxRepos/software/node-$DT_OS_TYPE-*
export ATOM_NODE_VER=8.11.3
export PATH=$ATOM_SANDBOX/node/bin:$ATOM_TOP/node_modules/.bin:$PATH
#
#
# Set this variable if you require additional options when doing npm installs
# (run from sandbox/configure-sandbox).  For example, doing npm installs from
# inside a docker container requires --unsafe-perm
#
# export ATOM_NPM_INSTALL_XTRA_OPTS=

# Add $MY_SANDBOX/bin to the search path
export PATH=$ATOM_TOP/bin:$PATH

# Uncomment if you want to short circuit the sandbox hooks (see hooks/git_hooks.sh).
# Similar to running 'git commit --no-verify'
# export ATOM_DISABLE_GIT_HOOKS=1

# Standard locations inside the sandbox
export ATOM_LOGS=$ATOM_SANDBOX/log    # Log directory
export ATOM_TMP=$ATOM_SANDBOX/tmp     # temp directory
export ATOM_CONFS=$ATOM_SANDBOX/conf  # config files directory
export ATOM_DATA=$ATOM_SANDBOX/data   # data directory
export ATOM_PIDS=$ATOM_SANDBOX/pid    # pid files directory

# Defines the asset build environment (usually 'local', 'dev' or 'prod')
# Used mostly when building assets or creating config files
[ -z "$ATOM_ASSET_ENV" ] && export ATOM_ASSET_ENV=local

# Defines the run-time environment (usually 'local', 'qa', 'pd', 'prod')
# Used for configuring a sandbox for a specific environment at run-time.
[ -z "$ATOM_ENV" ] && export ATOM_ENV=local
