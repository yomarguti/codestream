var _levels = {
		'ERROR': 0,
		'WARN':  1,
		'INFO':  2,
		'DEBUG': 3,
		'TRACE': 4,
		'TICK':  5
	},
	_objectIdSeed = 0;

function _normalizeLevel (level) {
	var requestedLevel = level;

	if (typeof level === 'string') {
		level = level.toUpperCase();
		level = _levels[level];
	}

	if (level == null) {
		throw new Error('Unknown log level: ' + requestedLevel);
	}

	return level;
}

function Logger (_className, _level, _handlers, _parent) {
	var me = this,
		_childLoggers = [],
		_tickLevel = _levels['TICK'],
		_levelChangeListeners = [],
		_tick,
		_name;

	_level = _normalizeLevel(_level);
	_handlers = (_handlers && _handlers.slice) ? _handlers.slice() : [];

	function Tick (logger) {
		var me = this,
			lastTick = +new Date();

		me.tock = function (message) {
			if (_level < _tickLevel) {
				return;
			}

			var now = +new Date(),
				elapsed = now - lastTick;

			lastTick = now;
			logger.trace('[' + elapsed + 'ms] ' + message);
		}
	}

	function _log (msgLevel, args) {
		var msgLevelName = msgLevel,
			msg;
		msgLevel = _normalizeLevel(msgLevel);

		if (msgLevel <= _level) {
			for (let i = 0; i < args.length; i++) {
				let arg = args[i];
				if (arg == null) {
					arg = '' + arg;
				} else if (typeof arg === 'object') {
					arg = JSON.stringify(arg).substring(0, 32) + '...';
				}
				args[i] = arg;
			}
			msg = [].join.call(args, ' ');
			msg = '[' + msgLevelName + '] '
				+ (_className ? '[' + _className + '] ' : '')
				+ msg;

			_handlers.forEach(function (handlerFn) {
				try {
					handlerFn.call(me, msgLevel, msg);
				} catch (err) {
					console.error(err);
				}
			});

			return true;
		}
	}

	for (_name in _levels) {
		let lowerCaseName = _name.toLowerCase();
		me[lowerCaseName] = me[_levels[_name]] = (function () {
			var l = _name;
			return function () {
				return _log(l, arguments);
			}
		}());
	}

	me.print = function (msg) {
		_handlers.forEach(function (handlerFn) {
			handlerFn.call(me, 'INFO', msg);
		});
	}

	me.tick = function () {
		return _tick = new Tick(me);
	}

	me.tock = function () {
		if (!_tick) {
			return this.error('Logger.tock() must be invoked after Logger.tick()');
		}
		return _tick.tock.apply(this, arguments);
	}

	me.forClass = function (className) {
		var childLogger = new Logger(className, _level, _handlers, me);
		_childLoggers.push(childLogger);
		return childLogger;
	}

	me.forObject = function (className, id) {
		return this.forClass(className + '-' + (id || ++_objectIdSeed));
	}

	me.getLevel = function () {
		return _level;
	}

	me.setLevel = function (level, path) {
		level = _normalizeLevel(level);
		if (!path || (_className && _className.indexOf(path) >= 0)) {
			_level = level;
		}

		_levelChangeListeners.forEach(function (listener) {
			listener.call(this, level, path);
		});

		_childLoggers.forEach(function (childLogger) {
			childLogger.setLevel(level, path);
		});
	}

	me.addHandler = function (handlerFn) {
		_handlers.push(handlerFn);
		_childLoggers.forEach(function (childLogger) {
			childLogger.addHandler(handlerFn);
		});
	}

	me.onLevelChange = function (fn) {
		_levelChangeListeners.push(fn);
	}

	me.destroy = function () {
		_parent._removeChild(me);
	}

	me._removeChild = function (child) {
		var index = _childLoggers.indexOf(child);

		if (index >= 0) {
			_childLoggers.splice(index, 1);
		}
	}
}

var _instance = new Logger(null, 'INFO');

Logger.getInstance = function () {
	return _instance;
}

module.exports = Logger;
