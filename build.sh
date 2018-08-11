#!/bin/bash

clj -m cljs.main -t node -O simple -o bot.js -c bot.main
