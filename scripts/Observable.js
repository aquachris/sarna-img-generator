module.exports = (function () {

  /**
   * @class The base prototype for all objects that can trigger events. The event system  uses event categories called "topics" that
   * may be registered for each Observable instance. For instance the class Person might register the topic "isHungry".
   * The event "isHungry" may then be fired by each instance of Person.
   *
   * _Note:_ Classes extending this class should add `Observable.call(this)` as the first line in their constructor.
   * `this.parent.call(this)` will not work, for reasons not entirely understood at the time of writing this.
   */
  var Observable = function() {
  	this.listeners = {};
  };

  /**
   * Add an event topic to this class. Duplicate topics will be ignored.
   *
   * @param topic {String} The event topic to add.
   */
  Observable.prototype.addEventTopic = function(topic) {
  	//this.listeners = this.listeners || {};
  	if(!this.listeners.hasOwnProperty(topic)) {
  		this.listeners[topic] = [];
  	}
    return this;
  };

  /**
   * Add multiple event topics.
   *
   * @param topic {...String} The event topic to add. Repeat argument for several topics.
   */
  Observable.prototype.addEventTopics = function() {
  	for(var i = 0; i < arguments.length; i++) {
  		this.addEventTopic(arguments[i]);
  	}
    return this;
  };

  /**
   * Trigger an event for this object.
   *
   * @param topic {String} The event topic. Must be a registered event topic for this object.
   * @param args {Array} The event arguments
   */
  Observable.prototype.fireEvent = function(topic, args) {
  	var listener;
  	//this.listeners = this.listeners || {};
  	if(!this.listeners.hasOwnProperty(topic)) {
  		console.warn('cannot fire event: observable does not have listener topic "' + topic + '"');
  		return;
  	}
  	for(var i = this.listeners[topic].length - 1; i >= 0; i--) {
  		listener = this.listeners[topic][i];
  		listener.func.apply(listener.scope, args);
  		//listener.func.call(listener.scope, args);
  		if(listener.once === true) {
  			this.listeners[topic].splice(i, 1);
  		}
  	}
    return this;
  };

  /**
   * Register a listener on this Observable, reacting to an event of the given event topic.
   *
   * @param topic {String} The event topic to listen to. Must be a registered event topic for this object.
   * @param scope {Object} The listener function's this scope
   * @param func {Function} The listener function
   * @param [oneTime=false] {boolean} true if the listener should be unregistered after being executed once
   */
  Observable.prototype.registerListener = function(topic, func, scope, oneTime) {
    scope = scope || this;
  	//this.listeners = this.listeners || {};
  	if(!this.listeners.hasOwnProperty(topic)) {
  		console.warn('cannot register listener: observable does not have listener topic "' + topic + '"');
  		return this;
  	}
  	if(!func || typeof func !== 'function') {
  		console.warn('cannot register listener for topic "'+topic+'": callback is not a function');
  		return this;
  	}
  	// check if this listener has already been registered
  	for(var i = 0, len = this.listeners[topic].length; i < len; i++) {
  		if(this.listeners[topic][i].scope === scope && this.listeners[topic][i].func === func) {
  			console.warn('listener for '+topic+' is already registered, skipping');
  			return this;
  		}
  	}
  	this.listeners[topic].push({
  		scope: scope,
  		func: func,
  		source : this,
  		once: oneTime || false
  	});

    return this;
  };

  /**
   * Register a one-time listener on this Observable, reacting to an event of the given event topic once.
   *
   * @param topic {String} The event topic to listen to. Must be a registered event topic for this object.
   * @param scope {Object} The listener function's this scope
   * @param func {Function} The listener function
   */
  Observable.prototype.registerOneTimeListener = function(topic, func, scope) {
    return this.registerListener(topic, scope, func, true);
  };

  /**
   * Unregister an existing listener on this Observable.
   *
   * @param topic {String} The listener's event topic
   * @param scope {Object} The listener function's this scope
   * @param func {Function} The listener function
   */
  Observable.prototype.unregisterListener = function(topic, func, scope) {
    scope = scope || this;
  	//this.listeners = this.listeners || {};
  	if(!this.listeners.hasOwnProperty(topic)) {
  		console.warn('cannot unregister listener: observable does not have listener topic "' + topic + '"');
  		return this;
  	}
  	for(var i = 0, len = this.listeners[topic].length; i < len; i++) {
  		var listener = this.listeners[topic][i];
  		if(listener.scope === scope && listener.func === func) {
  			this.listeners[topic].splice(i, 1);
  			return this;
  		}
  	}
    return this;
  };

  // synonyms for verbose function names
  /**
   * Alias for {@link Observable#fireEvent}
   * @function
   */
  Observable.prototype.fire = Observable.prototype.fireEvent;
  /**
   * Alias for {@link Observable#registerListener}
   * @function
   */
  Observable.prototype.on = Observable.prototype.registerListener;
  /**
   * Alias for {@link Observable#registerOneTimeListener}
   * @function
   */
  Observable.prototype.once = Observable.prototype.registerOneTimeListener;
  /**
   * Alias for {@link Observable#unregisterListener}
   * @function
   */
  Observable.prototype.off = Observable.prototype.unregisterListener;
  /**
   * Alias for {@link Observable#unregisterListener}
   * @function
   */
  Observable.prototype.un = Observable.prototype.unregisterListener;

  return Observable;
})();
