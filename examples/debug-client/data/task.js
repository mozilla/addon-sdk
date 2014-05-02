(function(exports) {
"use strict";

const spawn = (task, ...args) => {
  return new Promise((resolve, reject) => {
    try {
      const routine = task(...args);
      const raise = error => routine.throw(error);
      const step = data => {
        const { done, value } = routine.next(data);
        if (done)
          resolve(value);
        else
          Promise.resolve(value).then(step, raise);
      }
      step();
    } catch(error) {
      reject(error);
    }
  });
}
exports.spawn = spawn;

})(Task = {});
