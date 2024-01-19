'use strict';

function Sensor() {
}

Sensor.prototype.init = function (callback) {
    callback();
}

Sensor.prototype.read = function (callback) {
    callback(null, {
        temperature: random(20, 30),
        humidity: random(60, 80)
    })
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

module.exports = Sensor;
