function createTransitionManager() {
  let prompt = null;

  function setPrompt(nextPrompt) {
    prompt = nextPrompt;
    return () => {
      if (prompt === nextPrompt) prompt = null;
    };
  }

  function confirmTransitionTo(
    location,
    action,
    getUserConfirmation,
    callback
  ) {
    if (prompt != null) {
      const result =
        typeof prompt === 'function' ? prompt(location, action) : prompt;

      if (typeof result === 'string') {
        if (typeof getUserConfirmation === 'function') {
          getUserConfirmation(result, callback);
        } else {
          callback(true);
        }
      } else {
        callback(result !== false);
      }
    } else {
      callback(true);
    }
  }

  const listeners = []

  function appendListener(listener) {
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1)
  }

  function notifyListeners(...args) {
    listeners.forEach(listener => listener(...args));
  }

  return {
    setPrompt,
    confirmTransitionTo,
    appendListener,
    notifyListeners
  };
}

export default createTransitionManager;
