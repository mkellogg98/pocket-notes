/* Pip, your Pocket Idea Pal: a pilot duck.
 *
 * A small companion who lives on top of Pocket Notes. Most of the time he keeps himself busy:
 * wandering, sitting on your text boxes and pictures, reading your note's title, shoving or
 * lifting toolbar buttons, doing little tricks (loop-the-loops in aviation mode), and napping
 * when you go quiet. Now and then he chases the cursor, and he perches on the line you're typing.
 * He talks like a pilot when aviation touches are on, and like a regular duck when they're off.
 * He never takes clicks: the pointer passes straight through him.
 *
 * window.Pip.enable() / .disable() turn him on and off. The app tells him about events with
 * window.dispatchEvent(new CustomEvent("pip", {detail: {type: "new-note"}})).
 */
(function () {
  "use strict";
  var SIZE = 46;
  var SLEEP_AFTER = 45000;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // On a phone (the Pocket Notes web app sets PIP_MOBILE): he keeps to what's visible above the
  // keyboard, stays off the line you're typing, naps sooner, and his bed is a tiny nest in the
  // top bar that he walks up to, getting smaller as if heading off into the distance.
  var MOBILE = !!window.PIP_MOBILE;
  if (MOBILE) SLEEP_AFTER = 25000;
  var FAR = 160;   // how far from his little house he starts to shrink (phone)

  var CSS = [
    "#pip { position: fixed; left: 0; top: 0; width: 46px; height: 46px; z-index: 40; pointer-events: none; will-change: transform; transform-origin: 50% 100%; }",
    "#pip .bob * { touch-action: none; }",
    // Phone: tucked into his tiny nest (only his head shows over the rim); the nest does the z's.
    "#pip.in-nest .zzz, #pip.in-nest .shadow { display: none !important; }",
    // Only his drawn shapes catch the pointer (so you can pick him up); the space around him does not.
    "#pip .bob * { pointer-events: visiblePainted; cursor: grab; }",
    "#pip.held .bob * { cursor: grabbing; }",
    "#pip.held .bob { animation: pip-dangle .5s ease-in-out infinite alternate; }",
    "@keyframes pip-dangle { from { transform: rotate(-9deg); } to { transform: rotate(9deg) translateY(1px); } }",
    "#pip.held .feet { transform: translateY(2px); }",
    ".pip-flying-copy { position: fixed !important; margin: 0 !important; z-index: 45 !important; pointer-events: none !important; box-sizing: border-box; }",
    ".pip-duck .flip, .pip-duck svg { width: 100%; height: 100%; display: block; overflow: visible; }",
    ".pip-duck .bob { transform-box: fill-box; transform-origin: 50% 100%; }",
    ".pip-duck.walking .bob { animation: pip-waddle .3s ease-in-out infinite alternate; }",
    "@keyframes pip-waddle { from { transform: rotate(-7deg); } to { transform: rotate(7deg) translateY(-1.5px); } }",
    ".pip-duck .foot-a, .pip-duck .foot-b { transform-box: fill-box; }",
    ".pip-duck.walking .foot-a { animation: pip-step .3s ease-in-out infinite alternate; }",
    ".pip-duck.walking .foot-b { animation: pip-step .3s ease-in-out infinite alternate-reverse; }",
    "@keyframes pip-step { from { transform: translateY(0); } to { transform: translateY(-2.5px); } }",
    ".pip-duck.flying .bob { animation: pip-glide 1.1s ease-in-out infinite alternate; }",
    "@keyframes pip-glide { from { transform: rotate(-10deg) translateY(-3px); } to { transform: rotate(-4deg) translateY(2px); } }",
    ".pip-duck .wing { transform-box: fill-box; transform-origin: 85% 30%; }",
    ".pip-duck.flying .wing { animation: pip-flap .15s ease-in-out infinite alternate; }",
    "@keyframes pip-flap { from { transform: rotate(-28deg); } to { transform: rotate(20deg); } }",
    ".pip-duck .goggles { transition: transform .25s ease; }",
    ".pip-duck.flying .goggles { transform: translate(2px, 6.5px); }",
    ".pip-duck .feet, .pip-duck .shadow { transition: opacity .2s; }",
    ".pip-duck.flying .feet, .pip-duck.sitting .feet { opacity: 0; }",
    ".pip-duck.flying .shadow { opacity: 0; }",
    ".pip-duck.sitting .bob { transform: translateY(3px); }",
    ".pip-duck .eye-closed { display: none; }",
    ".pip-duck.sleeping .eye-open { display: none; }",
    ".pip-duck.sleeping .eye-closed { display: inline; }",
    ".pip-duck .scarf-tail { transform-box: fill-box; transform-origin: 100% 40%; animation: pip-scarf .55s ease-in-out infinite alternate; }",
    ".pip-duck.flying .scarf-tail { animation-duration: .18s; }",
    "@keyframes pip-scarf { from { transform: rotate(-6deg) scaleX(.95); } to { transform: rotate(5deg) scaleX(1.05); } }",
    ".pip-duck.bounce .bob { animation: pip-bounce .24s ease-out; }",
    "@keyframes pip-bounce { 0% { transform: translateY(3px); } 45% { transform: translateY(-7px) rotate(-4deg); } 100% { transform: translateY(3px); } }",
    ".pip-duck.spin .bob { animation: pip-spin .7s cubic-bezier(.3,.1,.3,1); }",
    "@keyframes pip-spin { 0% { transform: rotate(0); } 40% { transform: translateY(-14px) rotate(200deg); } 100% { transform: rotate(360deg); } }",
    ".pip-duck.preen .bob { animation: pip-preen .9s ease-in-out; }",
    "@keyframes pip-preen { 0%,100% { transform: none; } 20% { transform: rotate(-9deg) scale(1.04,.96); } 40% { transform: rotate(8deg) scale(.97,1.04); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(4deg) scale(1.03,.97); } }",
    ".pip-duck.lifting .bob { animation: pip-lifting 1.3s ease-in-out; }",
    "@keyframes pip-lifting { 0%,100% { transform: none; } 20%,55% { transform: translateY(-7px) scale(.96,1.06); } 75% { transform: translateY(1px) scale(1.05,.95); } }",
    ".pip-duck .zzz { position: absolute; left: 34px; top: -8px; font: 700 13px Georgia, serif; color: var(--muted, #777); display: none; }",
    ".pip-duck.sleeping .zzz { display: block; animation: pip-z 2.4s ease-out infinite; }",
    "@keyframes pip-z { 0% { opacity: 0; transform: translate(0, 6px) scale(.8); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -12px) scale(1.15); } }",
    ".pip-bubble { position: fixed; left: 0; top: 0; z-index: 41; pointer-events: none; max-width: 260px;",
    "  background: var(--paper, #fff); color: var(--ink, #111); border: 1px solid var(--line, #ccc); border-radius: 10px;",
    "  padding: 4px 10px; font: 12.5px/1.35 'Segoe UI', system-ui, sans-serif; box-shadow: 0 4px 14px var(--shadow, rgba(0,0,0,.2));",
    "  opacity: 0; transition: opacity .15s; }",
    ".pip-bubble.show { opacity: 1; }",
    // What happens to buttons he plays with: a real shove, or being lifted overhead for a moment.
    ".pip-push { position: relative; z-index: 5; animation: pip-push .85s cubic-bezier(.3,1.5,.5,1); }",
    ".pip-push-left { position: relative; z-index: 5; animation: pip-push-left .85s cubic-bezier(.3,1.5,.5,1); }",
    "@keyframes pip-push { 0% { transform: none; } 30% { transform: translateX(22px) rotate(8deg); } 60% { transform: translateX(15px) rotate(3deg); } 100% { transform: none; } }",
    "@keyframes pip-push-left { 0% { transform: none; } 30% { transform: translateX(-22px) rotate(-8deg); } 60% { transform: translateX(-15px) rotate(-3deg); } 100% { transform: none; } }",
    ".pip-lift { position: relative; z-index: 5; animation: pip-lift 1.3s ease-in-out; }",
    "@keyframes pip-lift { 0% { transform: none; } 20% { transform: translateY(-13px) rotate(-3deg); } 38% { transform: translateY(-14px) rotate(3deg); } 55% { transform: translateY(-13px) rotate(-2deg); }",
    "  75% { transform: translateY(1px); } 86% { transform: translateY(-3px); } 100% { transform: none; } }",
    ".pip-duck.stretch .bob { animation: pip-stretch 1.6s ease-in-out; }",
    "@keyframes pip-stretch { 0%,100% { transform: none; } 25% { transform: scale(.94,1.13) translateY(-2px); } 50% { transform: scale(1.06,.94); } 75% { transform: scale(.95,1.11) rotate(4deg); } }",
    ".pip-duck.stretch .wing { animation: pip-wing-up 1.6s ease-in-out; }",
    "@keyframes pip-wing-up { 0%,100% { transform: none; } 25%,75% { transform: rotate(-55deg); } 50% { transform: rotate(-20deg); } }",
    // Outfits: the hat replaces the aviator cap; props are extras layered on.
    ".pip-duck .acc { display: none; }",
    ".pip-duck[data-hat='beanie'] .acc-beanie, .pip-duck[data-hat='nightcap'] .acc-nightcap, .pip-duck[data-hat='santa'] .acc-santa, .pip-duck[data-hat='witch'] .acc-witch { display: inline; }",
    ".pip-duck[data-hat]:not([data-hat='cap']) .cap, .pip-duck[data-hat]:not([data-hat='cap']) .goggles { display: none; }",
    ".pip-duck[data-shades] .goggles { transform: translate(2px, 6.5px); }",
    ".pip-duck[data-shades] .lens { fill: #2b2b2b; }",
    ".pip-duck[data-props~='noscarf'] .scarf { display: none; }",
    "@media (prefers-reduced-motion: reduce) { .pip-duck *, .pip-push, .pip-push-left, .pip-lift { animation: none !important; transition: none !important; } }"
  ].concat(["party", "ears", "heart", "shamrock", "flower", "leaf", "coffee", "bowtie", "headphones", "badge", "balloon", "plane",
            "book", "bib", "sandwich", "disguise", "pj", "lids"].map(function (p) {
    return ".pip-duck[data-props~='" + p + "'] .acc-" + p + " { display: inline; }";
  })).join("\n");

  // Facing right in a 64x64 box. Feet touch the bottom edge. Outfit pieces (class "acc") are
  // hidden unless today's outfit calls for them; the scarf takes the day's color.
  var SCARF = 'style="fill: var(--pip-scarf, #d64545)"';
  var SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<ellipse class="shadow" cx="31" cy="61.5" rx="15" ry="2.4" fill="rgba(0,0,0,.2)"/>' +
    '<g class="bob">' +
      // Friday's balloon is tied to his tail, so it's drawn behind him.
      '<g class="acc acc-balloon"><path d="M8 40C4 30 9 22 4 13" fill="none" stroke="#777" stroke-width=".7"/>' +
        '<ellipse cx="4" cy="6" rx="6" ry="7.4" ' + SCARF + ' stroke="rgba(0,0,0,.25)" stroke-width=".7"/>' +
        '<path d="M3 13.2l1-.9 1 .9Z" ' + SCARF + '/><ellipse cx="2" cy="3.6" rx="1.4" ry="2.2" fill="#fff" opacity=".45"/></g>' +
      '<g class="feet">' +
        '<path class="foot-a" d="M24 54v4.5h-4.5l5 2.5h4v-7z" fill="#f08a24"/>' +
        '<path class="foot-b" d="M33 54v4.5h-4.5l5 2.5h4v-7z" fill="#dc7614"/>' +
      '</g>' +
      '<path class="scarf-tail scarf" d="M33 35C25 33 18 37 9 33.5l2.5 5.5C19 41 26 38.5 33 39.5Z" ' + SCARF + '/>' +
      '<path d="M13 42 5.5 36.5l2.2 9.2Z" fill="#f7c948" stroke="#c99a1e" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<ellipse cx="30" cy="44.5" rx="18" ry="12.5" fill="#f7c948" stroke="#c99a1e" stroke-width="1.2"/>' +
      '<g class="acc acc-pj" fill="#9bb7e8" opacity=".85"><circle cx="20" cy="47" r="1.6"/><circle cx="27" cy="52" r="1.6"/>' +
        '<circle cx="35" cy="49.5" r="1.6"/><circle cx="24" cy="40.5" r="1.6"/><circle cx="41" cy="45" r="1.6"/><circle cx="31" cy="44" r="1.6"/></g>' +
      '<g class="acc acc-badge"><rect x="23" y="45" width="11" height="7" rx="1.2" fill="#fbfbf7" stroke="#5f6d69" stroke-width=".7"/>' +
        '<rect x="23" y="45" width="11" height="2.2" rx="1" ' + SCARF + '/>' +
        '<text x="28.5" y="51.2" text-anchor="middle" font-size="3.6" font-family="Segoe UI, sans-serif" font-weight="700" fill="#1d2624">PIP</text></g>' +
      '<path class="wing" d="M19.5 42c4-6.5 15-5.5 17.5 1.5-4 6-13 7-17.5-1.5Z" fill="#ebb52f" stroke="#c99a1e" stroke-width="1"/>' +
      '<circle cx="42" cy="25" r="11.5" fill="#f7c948" stroke="#c99a1e" stroke-width="1.2"/>' +
      '<path class="scarf" d="M32 33q8 5 16 0l-1 4.2q-7 4-14 0Z" ' + SCARF + '/>' +
      '<g class="acc acc-bowtie"><path d="M40 36.6l-4.6-2.8v6.4Zm0 0 4.6-2.8v6.4Z" fill="#2b2238" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>' +
        '<circle cx="40" cy="36.6" r="1.3" fill="#4a3d5c"/></g>' +
      '<path class="acc acc-bib" d="M36 33.5h14l-7 9.5Z" fill="#fbfbf7" stroke="#cfcfc8" stroke-width=".8"/>' +
      '<path class="acc acc-bib" d="M39 34.6h2v2h-2zM43.5 34.6h2v2h-2zM41.2 37.6h2v2h-2z" fill="#e05050" opacity=".7"/>' +
      '<path d="M52 25q9 .5 9.5 3-3.5 2.5-9.5 2Z" fill="#f08a24" stroke="#c96a12" stroke-width="1"/>' +
      '<g class="eye-open"><circle cx="46" cy="23.5" r="3.4" fill="#fff" stroke="#3a2a1a" stroke-width=".8"/>' +
        '<circle class="pupil" cx="46.4" cy="23.6" r="1.7" fill="#1d1d1d"/></g>' +
      '<path class="eye-closed" d="M43 24q3 2.2 6 0" stroke="#3a2a1a" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path class="acc acc-lids" d="M42.6 23.5a3.4 3.4 0 0 1 6.8 0Z" fill="#f7c948" stroke="#3a2a1a" stroke-width=".8"/>' +
      '<g class="cap"><path d="M30.8 22C31 12 52 10 53 19.5l-3 .5c-3-5-14-5-16 3Z" fill="#7a4a2a" stroke="#4e2d16" stroke-width="1"/>' +
        '<path d="M33 22c-1 5 0 8 3 9l1-6Z" fill="#6a3f22" stroke="#4e2d16" stroke-width=".8"/></g>' +
      '<g class="goggles"><path d="M35 17.6 52.5 16.4" stroke="#3b3b3b" stroke-width="1.6"/>' +
        '<circle class="lens" cx="44" cy="17" r="3.4" fill="#9fd3e6" stroke="#3b3b3b" stroke-width="1.4"/>' +
        '<circle class="lens" cx="50.2" cy="16.6" r="2.6" fill="#9fd3e6" stroke="#3b3b3b" stroke-width="1.3"/>' +
        '<circle cx="43" cy="16" r="1" fill="#fff" opacity=".85"/></g>' +
      // Hats that replace the aviator cap
      '<g class="acc acc-beanie"><path d="M30.6 23.5C29.5 11 54.5 9.5 54 21Z" ' + SCARF + ' stroke="rgba(0,0,0,.25)" stroke-width="1"/>' +
        '<path d="M30.4 21.5C36 17.6 48 16.6 54.2 19.2l.2 3.4c-6-2.6-18-1.7-23.6 2.3Z" fill="#f4efe6" stroke="rgba(0,0,0,.2)" stroke-width=".8"/>' +
        '<circle cx="42.5" cy="9.6" r="3.6" fill="#f4efe6" stroke="rgba(0,0,0,.2)" stroke-width=".8"/></g>' +
      '<g class="acc acc-nightcap"><path d="M30.6 23.5C29.5 12 50 8 54 20Z" fill="#7d9ad6" stroke="#4f6aa8" stroke-width="1"/>' +
        '<path d="M33 15C27 10 19 13 16.5 22l3.2 1.2C21.5 17 26 15.5 31 18.5Z" fill="#7d9ad6" stroke="#4f6aa8" stroke-width="1"/>' +
        '<path d="M35 14.5l2.2 6M41 12.5l1.2 6.5M47 12.6l-.3 6.6" stroke="#e8eefc" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle cx="17" cy="23.5" r="3.2" fill="#f4efe6" stroke="#4f6aa8" stroke-width=".8"/></g>' +
      '<g class="acc acc-santa"><path d="M32.5 19.5C35 7 50 2 59 9.5c-4.2-.5-6.8 2-6.2 8.5Z" fill="#d22f2f" stroke="#9d1f1f" stroke-width="1"/>' +
        '<path d="M30.2 22.5C33 17 48 15.4 54.6 19.4l.4 3.6c-6.6-3.7-19.6-2.4-24.2 2.2Z" fill="#fbfbf7" stroke="rgba(0,0,0,.18)" stroke-width=".8"/>' +
        '<circle cx="59.2" cy="10.6" r="3.2" fill="#fbfbf7" stroke="rgba(0,0,0,.18)" stroke-width=".8"/></g>' +
      '<g class="acc acc-witch"><ellipse cx="42.5" cy="16.5" rx="15.5" ry="3.4" fill="#2b2238"/>' +
        '<path d="M35.5 16C38 8 41 0 46.5-3.5 45 3 48 9 50.5 16Z" fill="#2b2238"/><path d="M36.6 13.2h13.2l.5 2.2H36.1Z" fill="#f08a24"/></g>' +
      // Extras worn on top
      '<g class="acc acc-party"><path d="M39.5 12.6 45-2.5l5.5 14.5Z" fill="#8a55d6" stroke="#5d3596" stroke-width=".8" stroke-linejoin="round"/>' +
        '<path d="M41.5 7.2l6.3-.3M43 3l3.8-.2" stroke="#f7c948" stroke-width="1.5" stroke-linecap="round"/><circle cx="45" cy="-3" r="2.3" fill="#f7c948"/></g>' +
      '<g class="acc acc-ears"><path d="M37 15C33 6 34-4 37.5-4.5 41-5 41.5 5 40.5 14.5Z" fill="#fbfbf7" stroke="#cfcfc8" stroke-width=".9"/>' +
        '<path d="M37.6 12C35.8 5 36.4-1.5 37.8-2s2.2 6 1.7 14Z" fill="#f4a6c0"/>' +
        '<path d="M44 13.5C42 4 44.5-4.5 48-3.8s1.8 9.5-.8 17.6Z" fill="#fbfbf7" stroke="#cfcfc8" stroke-width=".9"/>' +
        '<path d="M45.3 11.5C44 5 45.5-1.5 47.4-1.4s1.2 6.8-.4 12.9Z" fill="#f4a6c0"/></g>' +
      '<path class="acc acc-heart" d="M36.5 19.5C32.4 16.3 33 12.6 35.6 12.8c.6.1 1 .5 1.2 1 .3-.5.7-.9 1.3-1 2.6-.1 3 3.6-1.6 6.7Z" fill="#e0457b" stroke="#a82c58" stroke-width=".6"/>' +
      '<g class="acc acc-shamrock" fill="#2f9e5b"><circle cx="35.4" cy="13.6" r="1.9"/><circle cx="38.4" cy="13.6" r="1.9"/><circle cx="36.9" cy="11.2" r="1.9"/>' +
        '<path d="M36.9 14.3 36.2 18.4" stroke="#2f9e5b" stroke-width="1" fill="none"/></g>' +
      '<g class="acc acc-flower"><g fill="#f49ac1"><circle cx="35.6" cy="11.6" r="1.7"/><circle cx="38.4" cy="12.4" r="1.7"/><circle cx="38.2" cy="15.2" r="1.7"/>' +
        '<circle cx="35.4" cy="15.6" r="1.7"/><circle cx="34.2" cy="13.4" r="1.7"/></g><circle cx="36.4" cy="13.7" r="1.3" fill="#f7c948"/></g>' +
      '<path class="acc acc-leaf" d="M33.5 17.5C33 12 37 9.5 41 10.2 40.5 14.5 38 17.8 33.5 17.5Zm0 0 4.6-4.9" fill="#d9822b" stroke="#9c5a17" stroke-width=".8"/>' +
      '<g class="acc acc-headphones"><path d="M32 22C31 9.5 53.5 8.5 53.6 19.5" fill="none" stroke="#2c2c2c" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="30.2" y="20.4" width="5" height="7.6" rx="2.2" fill="#2c2c2c"/><rect x="31.3" y="21.6" width="2.6" height="5.2" rx="1.2" ' + SCARF + '/></g>' +
      '<g class="acc acc-disguise"><circle cx="46" cy="23.5" r="3.9" fill="none" stroke="#1d1d1d" stroke-width="1.1"/><path d="M42.2 23 40 22" stroke="#1d1d1d" stroke-width="1"/>' +
        '<ellipse cx="53" cy="27.4" rx="2.8" ry="2.3" fill="#f0a8a0" stroke="#b46f68" stroke-width=".6"/><path d="M49.5 30c2-1.5 6-1.5 8 0-1.5 1.3-6 1.3-8 0Z" fill="#3a2a1a"/></g>' +
      // Things he holds
      '<g class="acc acc-coffee"><path d="M35 42.5h7.2v5.6a2.4 2.4 0 0 1-2.4 2.4h-2.4a2.4 2.4 0 0 1-2.4-2.4Z" fill="#fbfbf7" stroke="#6b4b2e" stroke-width="1"/>' +
        '<path d="M42.2 44h1.2a1.6 1.6 0 0 1 0 3.2h-1.2" fill="none" stroke="#6b4b2e" stroke-width="1"/><path d="M36.2 43.8h4.8" stroke="#7a4a2a" stroke-width="1.6"/>' +
        '<path d="M37.4 40.5c-.8-1 .8-1.8 0-3M40 40.5c-.8-1 .8-1.8 0-3" fill="none" stroke="#9aa" stroke-width=".8" stroke-linecap="round"/></g>' +
      '<path class="acc acc-plane" d="M33 41.5l13-3.5-8.5 9-1.2-3.7Zm3.3 1.8 9.7-5.3" fill="#fbfbf7" stroke="#8a9a96" stroke-width=".8" stroke-linejoin="round"/>' +
      '<g class="acc acc-book"><path d="M33.5 41.5l6-1.8 6 1.8v7.6l-6-1.8-6 1.8Z" fill="#3d6fd9" stroke="#26478f" stroke-width=".8"/><path d="M39.5 39.7v7.6" stroke="#fbfbf7" stroke-width=".9"/></g>' +
      '<g class="acc acc-sandwich"><path d="M33.5 43.5q6-3.5 12 0v1.6h-12Z" fill="#e9c27a" stroke="#b08840" stroke-width=".7"/><path d="M33 45.3h13l-1 1.4H34Z" fill="#6cbf5a"/>' +
        '<path d="M33.4 46.6h12.2l-.4 1.2H33.8Z" fill="#d95b4b"/><path d="M33.5 47.8h12v1.3q-6 2.2-12 0Z" fill="#e9c27a" stroke="#b08840" stroke-width=".7"/></g>' +
    '</g></svg>';

  // ---------- Outfits ----------
  // Season sets the base look, each weekday adds a prop and a scarf color (per season),
  // holidays take over, and lunch time and night time win over everything.

  var SCARVES = {   // Sunday to Saturday
    winter: ["#2e86c1", "#c0392b", "#1e8449", "#8e44ad", "#d35400", "#b03a2e", "#7f8c8d"],
    spring: ["#76c7c0", "#e88aa8", "#8fcf9a", "#f2c14e", "#9bb7e8", "#c39bd3", "#f5a77a"],
    summer: ["#fb5607", "#ff6b6b", "#ffb703", "#2ec4b6", "#3a86ff", "#ff006e", "#8ac926"],
    autumn: ["#922b21", "#d9822b", "#a0522d", "#c0392b", "#b7950b", "#7d5a3c", "#e67e22"]
  };
  var DAY_PROPS = ["book", "coffee", "bowtie", "headphones", "badge", "balloon", "plane"];
  var HELD = { coffee: 1, book: 1, plane: 1, sandwich: 1 };

  function easterOf(y) {   // Gregorian Easter (anonymous algorithm)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
        l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
  }
  function holidayOn(d) {
    var mo = d.getMonth() + 1, day = d.getDate(), e = easterOf(d.getFullYear());
    if (mo === 1 && day === 1) return { id: "newyear", props: ["party"], scarf: "#d4af37" };
    if (mo === 2 && day === 14) return { id: "valentine", props: ["heart"], scarf: "#e0457b" };
    if (mo === 3 && day === 17) return { id: "stpatrick", props: ["shamrock"], scarf: "#2f9e5b" };
    if (mo === 4 && day === 1) return { id: "aprilfools", props: ["disguise"], noShades: true };
    if (mo === e[0] && day === e[1]) return { id: "easter", props: ["ears"], scarf: "#c39bd3" };
    if (mo === 10 && day === 15) return { id: "pipday", props: ["party"], scarf: "#8a55d6" };
    if (mo === 10 && day === 31) return { id: "halloween", hat: "witch", scarf: "#f08a24" };
    if (mo === 11 && d.getDay() === 4 && day >= 22 && day <= 28) return { id: "thanksgiving", props: ["leaf"], scarf: "#a0522d" };
    if (mo === 12 && (day === 24 || day === 25)) return { id: "christmas", hat: "santa", scarf: "#1e8449" };
    if (mo === 12 && day === 31) return { id: "nye", props: ["party"], scarf: "#d4af37" };
    return null;
  }
  var cfg = { outfits: true, lunchTime: "12:00", date: null };
  function minsOf(hhmm) { var p = String(hhmm || "12:00").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function computeOutfit(d) {
    var mo = d.getMonth(), wd = d.getDay();
    var o = { hat: "cap", props: [], shades: false, day: wd, holiday: null, time: "day" };
    o.season = mo === 11 || mo < 2 ? "winter" : mo < 5 ? "spring" : mo < 8 ? "summer" : "autumn";
    o.scarf = SCARVES[o.season][wd];
    if (o.season === "winter") o.hat = "beanie";
    else if (o.season === "spring") o.props.push("flower");
    else if (o.season === "summer") o.shades = true;
    else o.props.push("leaf");
    o.props.push(DAY_PROPS[wd]);
    var h = holidayOn(d);
    if (h) {
      o.holiday = h.id;
      // A holiday hat replaces the cap, so the season's cap decoration goes too.
      if (h.hat) { o.hat = h.hat; o.shades = false; o.props = o.props.filter(function (p) { return p !== "flower" && p !== "leaf"; }); }
      if (h.scarf) o.scarf = h.scarf;
      if (h.noShades) o.shades = false;
      if (h.props) o.props = o.props.filter(function (p) { return p !== "flower" && p !== "leaf"; }).concat(h.props);
    }
    var mins = d.getHours() * 60 + d.getMinutes(), L = minsOf(cfg.lunchTime);
    if (mins >= L && mins < L + 45) {
      o.time = "lunch";
      o.props = o.props.filter(function (p) { return !HELD[p]; }).concat(["bib", "sandwich"]);
    }
    if (mins >= 22 * 60 || mins < 6 * 60) {
      o.time = "night";
      o.hat = "nightcap"; o.shades = false;
      o.props = ["pj", "lids", "noscarf"];
    }
    o.key = [o.hat, o.props.join(","), o.shades, o.scarf].join("|");
    return o;
  }

  // What Pip says. A regular duck by default...
  var LINES = {
    hello: ["Hi! I'm Pip, your Pocket Idea Pal.", "Hello again!", "Pip, your Pocket Idea Pal, at your service!", "Quack! Ready when you are.", "Oh good, you're here."],
    idle: ["Quack.", "Nice notes!", "*waddles*", "Hmm hmm hmm.", "Need a hand? I have wings.", "What are we writing today?",
           "I like it here.", "Is it snack time?", "*fluffs feathers*", "So organized. I love it.", "Bread would be nice.",
           "I'm helping!", "Don't mind me.", "Doo doo doo…", "Have you tried bold? It's very bold."],
    wake: ["Huh?", "I was just resting my eyes.", "I'm up! I'm up!", "Five more minutes…"],
    startled: ["Whoa!", "Eep!", "Watch it!", "Hey, I'm standing here!"],
    "new-note": ["A fresh page!", "Ooh, blank paper.", "New note! What's it about?"],
    "delete": ["Bye bye, note.", "Into the trash it goes.", "Gone! (It's in Trash.)"],
    pin: ["Pinned!", "That one's important.", "Up top it goes."],
    image: ["Nice picture!", "Ooh, pretty.", "Can I sit on it?"],
    link: ["A link! Where does it go?", "Ooh, clickable."],
    textbox: ["A new box!", "More room for ideas.", "Box! I love boxes."],
    poke: ["Quack!", "Hi there!", "That tickles!", "Yes? Need something?", "Boop."],
    bedPoke: ["Five more minutes…", "I'm resting. Very busy resting.", "Shh, I'm cozy.", "*snuggles*"],
    bedIn: ["Ahh, cozy. I'll stay right here.", "Bedtime? Don't mind if I do.", "My favorite spot!"],
    bedOut: ["I'm free!", "Back to work!", "Okay, okay, I'm up."],
    share: ["Company! Let's write together.", "Ooh, a group project!", "I'll save a seat for them."],
    "pip-ai": ["Done! How's that?", "Fresh words, hot off the press!", "I put my best feathers into that.", "Tell me if you want it different!"],
    held: ["Whee!", "Put me down!", "Where are we going?", "I can fly, you know."],
    bedIdle: ["This is nice.", "I can see everything from here.", "Comfy.", "I'll keep an eye on things.", "*yawn*"],
    rest: ["Time for a little rest.", "Just going to lie down a moment.", "Break time for Pip."],
    bedLeave: ["Refreshed!", "Okay, I'm back!", "That was a good rest."],
    newOutfit: ["Ooh, new outfit! How do I look?", "Dressed up! Thank you!", "Fancy!"],
    check: ["Check!", "One down!", "Nice, done!", "Tick!"],
    "all-done": ["All done! Celebration time!", "Every box ticked! You're amazing.", "Checklist complete. Treat yourself."],
    "reminder-set": ["Reminder set! I'll remind you. Probably.", "Got it. I'll tap you on the shoulder.", "I'll remember. I've written it on my wing."],
    "export": ["Saved a copy! Very professional.", "Ooh, a proper document."],
    reminder: ["Psst! Reminder: “{t}”", "Don't forget: “{t}”", "Hey! It's time: “{t}”"],
    lunchLine: ["Lunch time! Go eat something. I'll guard the notes.", "My tummy says it's lunch o'clock.", "Lunch! Bring me back a cracker?"],
    lunchBell: ["Ding ding ding! Lunch!", "Lunch bell! Come and get it!"],
    breakLine: ["Break time! Stand up and stretch with me.", "Wings up! Time for a stretch.", "Blink a few times. Your eyes will thank you.", "Water break! Ducks know hydration."],
    night: ["It's late. I'm in my jammies.", "Bedtime soon? I've got my nightcap on.", "*yawn* Still writing?"],
    morning: ["Good morning! Jammies off.", "Morning! Time to get dressed."],
    lunchOutfit: ["Bib on. I'm ready for lunch.", "Is that a sandwich? It's mine now."],
    push: ["Boop.", "Hup!", "Oops, did I do that?", "Just tidying."],
    lift: ["Heavy!", "Look how strong I am!", "Hup… hup…", "Where does this go?"],
    throw: ["Yeet!", "Catch!", "Fore!", "Oops. Butterfingers. Butterwings?", "Go fetch! No wait, I'll fetch."],
    fetch: ["Got it!", "I'll bring it back. Eventually.", "It came back on its own. Spooky."],
    trick: ["Ta-da!", "Did you see that?", "Wheee!"],
    preen: ["*fluffs feathers*", "Looking sharp.", "Gotta keep tidy."],
    visitBox: ["Comfy box.", "I'll sit here a sec.", "Good spot."],
    visitImage: ["Nice view from up here.", "Pretty picture!", "I'm part of the art now."],
    read: ["good title.", "sounds important.", "I like it.", "ooh, what's that about?"]
  };
  // ...and a pilot when aviation touches are on.
  var AV_LINES = {
    hello: ["Pip reporting for duty!", "Pocket Idea Pal, ready for takeoff!", "Clear skies today.", "Ready for takeoff!", "Pocket Tower, Pip on frequency.", "Pip holding short, ready for takeoff"],
    idle: ["Checking the instruments…", "*adjusts goggles*", "Smooth air so far.", "Altitude: one desk.",
           "Requesting snacks at cruising altitude.", "Winds calm, visibility great.", "Pocket Tower, Pip ready.",
           "Flaps up!", "Roger that.", "This is your captain quacking.", "Fuel check: bread levels low.",
           "Holding pattern…", "Cleared for takeoff on runway Notes.", "Mayday? No, just a Tuesday.", "Wilco."],
    wake: ["Huh? Who's flying?", "Back on duty!", "Autopilot off. I'm awake."],
    startled: ["Turbulence!", "Whoa, near miss!", "Pull up! Pull up!"],
    "new-note": ["New flight plan!", "Fresh logbook page.", "Filing a new route."],
    "delete": ["Note jettisoned.", "Dropped from the manifest.", "Ditched! It's in Trash."],
    pin: ["Pinned to the dashboard.", "Priority cargo!", "Marked on the chart."],
    image: ["Aerial photo, nice!", "Great shot, captain."],
    link: ["New waypoint added.", "A route to somewhere!"],
    textbox: ["Another cargo crate.", "New box on the manifest."],
    poke: ["Pip here, go ahead.", "Roger!", "You have the controls.", "Copy, captain."],
    bedPoke: ["Crew rest in progress.", "Hangar's closed, captain.", "Do not disturb: crew rest."],
    bedIn: ["Parked in the hangar. Chocks in.", "Crew rest! I'll stay put.", "Engines off. Cozy."],
    bedOut: ["Cleared for departure!", "Back on duty!", "Taxiing out!"],
    share: ["Formation flight! Wingmen welcome.", "Opening the cabin door for guests.", "Multi-crew operations, captain."],
    "pip-ai": ["Delivered on schedule, captain!", "Copy that. Words are on the ramp.", "Mission complete. Over!"],
    held: ["I have control! Oh wait, you do.", "Unscheduled flight!", "Whoa, turbulence!"],
    bedIdle: ["Monitoring the radio.", "Good view from the hangar.", "All quiet on the frequency.", "*yawn* Crew rest."],
    rest: ["Returning to the hangar.", "Heading in for crew rest.", "Parking for a bit."],
    bedLeave: ["Rested and ready for takeoff!", "Back in the air!"],
    check: ["Item complete.", "Checked off, captain.", "Check."],
    "all-done": ["Checklist complete. Cleared for takeoff!", "All items checked. Good to go!"],
    "reminder-set": ["Reminder filed with the tower.", "Logged. I'll call it in when it's time."],
    "export": ["Flight log exported.", "Copy filed with the tower."],
    reminder: ["Tower to captain: “{t}”", "Scheduled item: “{t}”", "Checklist reminder: “{t}”"],
    lunchLine: ["Fuel stop! Lunch break, captain.", "Refuelling time. Go grab lunch.", "Cleared for lunch. Taxi to the kitchen."],
    lunchBell: ["Ding ding! Galley's open!", "Meal service is starting!"],
    breakLine: ["Crew rest! Stretch your legs, captain.", "Seatbelt sign is off. Stretch break.", "Holding pattern: take five."],
    night: ["Night flight. Pajamas on.", "Red-eye mode. *yawn*"],
    morning: ["Morning! First flight of the day.", "Rise and shine, captain."],
    lunchOutfit: ["Galley's open! Bib on.", "In-flight meal service: sandwich."],
    push: ["Pre-flight check!", "Testing the controls.", "Control surfaces: free and correct."],
    lift: ["Cargo loaded!", "Lift-off!", "Heavy payload!", "Max takeoff weight!"],
    throw: ["Airdrop!", "Cargo released!", "Bombs away! Gently.", "Package away!"],
    fetch: ["Recovering the payload.", "Package retrieved. Returning to base."],
    trick: ["Loop-de-loop!", "Wheee!", "Barrel roll! Sort of.", "Don't tell air traffic control."],
    preen: ["Pre-flight grooming.", "Goggles, scarf, feathers. All set."],
    visitBox: ["Touchdown!", "Landing on the box.", "Smooth landing."],
    visitImage: ["Landed on the photo.", "Nice view from the tarmac."],
    read: ["logged in the flight plan.", "copy that.", "cleared for writing.", "roger."]
  };
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function aviation() { return document.body.classList.contains("aviation"); }
  function line(key) {
    // In aviation mode he's mostly a pilot, with the odd plain-duck remark for idle chatter.
    if (aviation() && AV_LINES[key] && (key !== "idle" || Math.random() < 0.75)) return pick(AV_LINES[key]);
    return pick(LINES[key] || AV_LINES[key]);
  }

  // What he says about what he's wearing.
  var DAY_LINES = {
    duck: ["Lazy Sunday. Reading a good book.", "Happy Monday. Coffee first.", "Bow tie Tuesday!", "Wednesday tunes. Halfway there!",
           "Name badge on. Very official Thursday.", "It's Friday! I brought a balloon.", "Saturday! Paper plane time."],
    pilot: ["Sunday: catching up on the flight manual.", "Monday pre-flight: coffee loaded.", "Tuesday: dress uniform today.",
            "Wednesday: on comms. Halfway to the weekend.", "Thursday: crew badge on.", "Friday! Weather balloon launched.",
            "Saturday: paper plane test flights."]
  };
  var SEASON_LINES = {
    winter: ["Brr. Beanie weather.", "Cold air, good lift. Beanie on."], spring: ["Spring! I picked a flower.", "Spring winds. Flower secured."],
    summer: ["Summer shades on.", "Sun's out. Shades down, captain."], autumn: ["I found a leaf! It's autumn.", "Autumn crosswinds. Kept a leaf."]
  };
  var HOLIDAY_LINES = {
    newyear: "Happy New Year! Party hat on.", valentine: "Happy Valentine's Day! I love your notes.",
    stpatrick: "Happy St. Patrick's Day! I'm wearing green.", aprilfools: "Who, me? I'm not Pip. Totally different duck.",
    easter: "Happy Easter! Do these ears suit me?", pipday: "It's my birthday! I hatched on October 15.",
    halloween: "Happy Halloween! Boo-quack!", thanksgiving: "Happy Thanksgiving! Grateful for you. And bread.",
    christmas: "Merry Christmas! Ho ho quack!", nye: "Last day of the year! Party hat on."
  };
  function outfitLine(o, prev) {
    var av = aviation() ? 1 : 0;
    if (o.time === "night" && (!prev || prev.time !== "night")) return line("night");
    if (o.time === "lunch" && (!prev || prev.time !== "lunch")) return line("lunchOutfit");
    if (o.holiday && (!prev || prev.holiday !== o.holiday)) return HOLIDAY_LINES[o.holiday];
    if (prev && prev.time === "night" && o.time !== "night") return line("morning");
    if (!prev || prev.day !== o.day) return Math.random() < 0.7 ? DAY_LINES[av ? "pilot" : "duck"][o.day] : SEASON_LINES[o.season][av];
    return null;
  }

  // Big announcements from the app: reminders, lunch, breaks. He flies to the middle and tells you.
  function announce(kind, text) {
    if (!enabled) return false;
    activity();
    P.forceFly = false;
    P.napping = false;
    var msg = kind === "reminder" ? line("reminder").replace("{t}", short(text || "Check your note", 70))
      : kind === "lunch" ? line("lunchLine") : line("breakLine");
    // Put to bed by you: he stays there and calls it out from the bed.
    var where = P.bed === "locked" ? null : { x: window.innerWidth / 2 - SIZE / 2, y: Math.max(90, window.innerHeight * 0.32) };
    if (where) { leaveBed(); P.state = "announce"; }
    P.until = now() + 8000;
    (where ? function (cb) { goTo(where.x, where.y, cb); } : function (cb) { cb(); })(function () {
      if (where) P.facing = 1;
      var style = Math.floor(Math.random() * 3);
      if (kind === "lunch") {
        // A few ways to call lunch: ring the dinner bell, a happy twirl, or a fluff-and-wiggle.
        if (style === 0) { msg = line("lunchBell"); [0, 300, 600].forEach(function (d) { setTimeout(bounce, d); }); }
        else if (style === 1) play("spin", 720);
        else play("preen", 920);
      } else if (kind === "break") {
        play("stretch", 1600);
      } else {
        [0, 300].forEach(function (d) { setTimeout(bounce, d); });
      }
      say(msg, 6500);
      P.until = now() + 5500;
    });
    return true;
  }

  var el = null, flip = null, pupil = null, bubble = null, zzz = null;
  var enabled = false, raf = 0, last = 0, bubbleTimer = 0, bounceTimer = 0, greeted = false;
  var P = { x: -60, y: 300, tx: -60, ty: 300, facing: 1, moving: false, flying: false, forceFly: false, sitting: false,
            state: "idle", until: 0, onArrive: null, anchor: null, look: null };
  var mouse = { x: -999, y: -999, t: 0 }, lastKey = 0, lastActivity = performance.now();

  function now() { return performance.now(); }
  // The part of the screen he can be in: on a phone, what's visible above the keyboard.
  function viewTop() { var vv = MOBILE && window.visualViewport; return vv ? vv.offsetTop : 0; }
  function viewBottom() { var vv = MOBILE && window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; }
  function typing() { return MOBILE && document.body.classList.contains("typing"); }
  function clampX(x) { return Math.max(4, Math.min(window.innerWidth - SIZE - 4, x)); }
  function clampY(y) { return Math.max(viewTop() + 4, Math.min(viewBottom() - SIZE - 4, y)); }
  function visible(elm) {
    if (!elm || !elm.offsetParent) return null;
    var r = elm.getBoundingClientRect();
    // A button slid out of view in a toolbar doesn't count.
    var track = elm.closest && elm.closest(".slide-track");
    if (track) { var tr = track.getBoundingClientRect(); if (r.left < tr.left - 1 || r.right > tr.right + 1) return null; }
    return r.width > 0 && r.top > 40 && r.bottom < viewBottom() - 10 && r.left >= 0 && r.right <= window.innerWidth ? r : null;
  }
  // Text boxes and pictures: on the computer's canvas, and in the phone's canvas and list views.
  var THINGS = ".thing, .cv-item, #boxesWrap .box, #picsWrap .pic";
  var BOX_TEXT = ".thing .tb, .cv-item .rt, #boxesWrap .box .rt";

  function build() {
    if (!document.getElementById("pip-style")) {
      var st = document.createElement("style");
      st.id = "pip-style"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    el = document.createElement("div");
    el.id = "pip";
    el.className = "pip-duck";
    el.innerHTML = '<div class="flip">' + SVG + '</div><div class="zzz">z</div>';
    flip = el.querySelector(".flip");
    pupil = el.querySelector(".pupil");
    zzz = el.querySelector(".zzz");
    bubble = document.createElement("div");
    bubble.className = "pip-bubble";
    bubble.setAttribute("role", "status");
    document.body.appendChild(el);
    document.body.appendChild(bubble);
    el.addEventListener("pointerdown", onPipDown);
    el.addEventListener("pointermove", onPipMove);
    el.addEventListener("pointerup", onPipUp);
    el.addEventListener("pointercancel", onPipUp);
    // Right-click Pip: the app shows his menu (outfits, bed).
    el.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("pip-menu", { detail: { x: e.clientX, y: e.clientY, inBed: !!P.bed } }));
    });
  }

  // ---------- Talking and small animations ----------

  // anchor: a screen rectangle to show the bubble above instead of above Pip (e.g. a button he's lifting).
  var bubbleAnchor = null;
  function say(text, ms, anchor) {
    if (!enabled || !bubble) return;
    bubbleAnchor = anchor || null;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { if (bubble) bubble.classList.remove("show"); bubbleAnchor = null; }, ms || 2600);
  }
  function play(cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
    setTimeout(function () { el && el.classList.remove(cls); }, ms);
  }
  function bounce() { play("bounce", 260); }
  function animateButton(b, cls, ms) {
    b.classList.remove(cls);
    void b.offsetWidth;
    b.classList.add(cls);
    setTimeout(function () { b.classList.remove(cls); }, ms);
  }

  // ---------- Movement ----------

  function goTo(x, y, cb) {
    P.tx = clampX(x); P.ty = clampY(y);
    P.onArrive = cb || null;
    P.sitting = false;
  }
  function goPath(points, cb) {
    var i = 0;
    (function next() {
      if (i >= points.length) { if (cb) cb(); return; }
      var p = points[i++];
      goTo(p.x, p.y, next);
    })();
  }
  function idle(ms) {
    P.state = "idle";
    P.until = now() + (ms || 2500);
    P.look = { x: P.x + (Math.random() - 0.5) * 300, y: P.y + (Math.random() - 0.5) * 200 };
    if (Math.random() < 0.15) say(line("idle"));
  }

  // ---------- Things he does on his own ----------

  function wander() {
    P.state = "wander";
    var W = window.innerWidth, top = viewTop(), H = viewBottom() - top;
    var x = 20 + Math.random() * (W - SIZE - 40);
    var y = top + H * 0.3 + Math.random() * (H * 0.7 - SIZE - 24);
    goTo(x, y, function () { idle(1500 + Math.random() * 3000); });
  }
  // Phone, while you type: keep to the strip just under the top bar, out of the way.
  function edgeWander() {
    P.state = "wander";
    var bar = document.querySelector(".screen:not([hidden]) .top"), y = bar ? bar.getBoundingClientRect().bottom - SIZE + 6 : viewTop() + 8;
    goTo(20 + Math.random() * (window.innerWidth - SIZE - 40), y, function () { P.sitting = true; idle(2500 + Math.random() * 3000); });
  }

  // Sit on top of a text box or picture for a bit.
  function visitThing() {
    var things = Array.prototype.filter.call(document.querySelectorAll(THINGS), function (t) { return visible(t); });
    if (!things.length) return wander();
    var t = pick(things), r = t.getBoundingClientRect(), isImage = t.classList.contains("image") || t.classList.contains("pic");
    P.state = "visit";
    goTo(r.left + Math.random() * Math.max(0, r.width - SIZE), r.top - SIZE + 5, function () {
      P.sitting = true;
      P.until = now() + 3000 + Math.random() * 3500;
      if (Math.random() < 0.6) say(line(isImage ? "visitImage" : "visitBox"));
    });
  }

  // Hop up onto the note's title and read it out.
  function readTitle() {
    var t = document.getElementById("titleIn"), r = visible(t);
    var title = t && t.value.trim();
    if (!r || !title) return idle(1500);
    P.state = "read";
    goTo(r.left + 4, r.top - SIZE + 10, function () {
      P.sitting = true;
      P.facing = 1;
      P.until = now() + 3200;
      P.look = { x: r.left + 120, y: r.top + 20 };
      say("“" + (title.length > 28 ? title.slice(0, 27) + "…" : title) + "” — " + line("read"), 3000);
    });
  }

  // A loop-the-loop in aviation mode, a twirl otherwise.
  function trick() {
    P.state = "trick";
    if (aviation() && !reduce) {
      // A circle whose bottom is where he is now: forward, up, over the top, and back down.
      var R = 48, cx = P.x, cy = Math.max(R + 8, P.y - R), pts = [];
      for (var i = 1; i <= 18; i++) {
        var a = i * Math.PI * 2 / 18;
        pts.push({ x: cx + Math.sin(a) * R * P.facing, y: cy + Math.cos(a) * R });
      }
      P.forceFly = true;
      goPath(pts, function () {
        P.forceFly = false;
        if (Math.random() < 0.7) say(line("trick"));
        idle(1500);
      });
    } else {
      play("spin", 720);
      if (Math.random() < 0.5) say(line("trick"));
      idle(1800);
    }
  }

  function preen() {
    play("preen", 920);
    if (Math.random() < 0.35) say(line("preen"));
    idle(1600);
  }

  // ---------- Reading the note ----------
  //
  // Pip's "reading" is a handful of simple rules that run right here on your computer (nothing
  // is sent anywhere): he spots topics by keyword, notices questions, exclamations, dates, money,
  // lists, repeated and long words, and how long the note is, then picks something to say. Often
  // he quotes a sentence, and walks over to stand on it while he does.

  var STOP = {};
  ("the a an and or but if then so to of in on at for with from by as is are was were be been being it its it's this that " +
   "these those i i'm you you're he she we they me my your our their his her them us not no yes do does did have has had " +
   "will would can could should just very really also about into over than too up down out more most some any all each " +
   "every what which who whom when where why how there here get got go going went make made like one two new now need " +
   "want don't can't im").split(" ").forEach(function (w) { STOP[w] = 1; });

  // {w} is the word that matched (with {W} capitalized). Duck voice first, pilot voice second.
  var TOPICS = [
    [/\b(eggs?|milk|bread|cheese|pizza|coffee|tea|snacks?|lunch|dinner|breakfast|groceries|grocery|apples?|bananas?|chicken|pasta|rice|cake|cookies?|sandwich|soup)\b/i,
      ["Did someone say {w}? Now I'm hungry.", "{W}! Save some for me.", "Is there bread on this list too? Asking for me."],
      ["{W} for the in-flight meal?", "Adding {w} to the galley order.", "Catering request: {w}. Noted."]],
    [/\b(flights?|fly|flying|planes?|airports?|trips?|travel|vacation|hotel|passport|beach|holiday|airplane)\b/i,
      ["A {w}? Take me with you!", "Ooh, {w}. Fancy.", "I can fly, you know. Just saying."],
      ["{W}! Now we're talking.", "I'll file the flight plan for that {w}.", "{W} logged. Window seat, please."]],
    [/\b(meetings?|deadlines?|projects?|emails?|boss|work|reports?|presentations?|clients?|invoices?)\b/i,
      ["{W}… not my favorite word.", "You've got this {w} handled.", "Work stuff. I'll keep quiet. (I won't.)"],
      ["{W}: logged. Stay on course.", "Busy schedule. Autopilot engaged.", "{W} on the flight plan. Steady as she goes."]],
    [/\b(tired|sad|stressed|angry|anxious|sick|exhausted|worried|upset)\b/i,
      ["Sounds like a rough day. Quack-hug?", "Hang in there. I'm on your side.", "Being {w} is no fun. Take a break?"],
      ["Rough air. We'll get through it.", "Turbulence passes. Promise.", "Feeling {w}? Time for a holding pattern and a snack."]],
    [/\b(happy|excited|great|awesome|love|fun|amazing|yay|wonderful|fantastic)\b/i,
      ["That sounds {w}! Quack!", "Love the energy.", "{W}! That's the spirit."],
      ["Smooth skies ahead!", "Positive rate of climb!", "{W}! Morale at cruising altitude."]],
    [/\b(ducks?|pip|birds?|feathers?|ponds?|geese|goose)\b/i,
      ["Did you write “{w}”? I'm flattered.", "Ducks are great. Good topic.", "{W}? Is this about me?"],
      ["A {w}? Is this about me, captain?", "{W} spotted on the radar."]],
    [/\b(birthday|party|gift|present|wedding|anniversary|celebrate|celebration)\b/i,
      ["A {w}! Is there cake?", "Celebrations! Count me in.", "{W}! I'll bring the quacks."],
      ["{W}! Prepare for a fly-by.", "Requesting confetti drop for the {w}."]],
    [/\b(rain|snow|sunny|weather|storm|wind|windy|clouds?|forecast|hot|cold)\b/i,
      ["{W}? Ducks love a bit of weather.", "Weather report noted.", "{W}. I have feathers for that."],
      ["{W}: checking conditions for takeoff.", "Pilots always watch the {w}.", "Forecast noted: {w}."]],
    [/\b(gym|run|running|workout|exercise|walk|walking|yoga|swim|swimming)\b/i,
      ["{W}? I waddle. It counts.", "Stay strong!", "{W}! I'll cheer from here."],
      ["{W}: pre-flight fitness check!", "Pilots need cardio too."]],
    [/\b(study|studying|exams?|tests?|homework|class|school|learn|learning|quiz)\b/i,
      ["Studying? I'll be quiet. Mostly.", "You'll ace that {w}.", "{W}! Brain power activated."],
      ["Ground school! Good luck on the {w}.", "Study hard, fly far.", "Study safe, fly hard"]],
    [/\b(sleep|nap|bed|tired|rest)\b/i,
      ["{W}? Ooh, I love a good {w}.", "Naps are underrated."],
      ["Crew rest is important. {W} approved."]],
    [/\b(dog|dogs|cat|cats|puppy|kitten|pet|pets)\b/i,
      ["A {w}? Are they friendly to ducks?", "{W}! I'd like to meet them. From a distance."],
      ["{W} on board? Check their seatbelt."]]
  ];

  var DATE_RE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today|next week|next month|this weekend|\d{1,2}(:\d\d)\s?(am|pm)?|\d{1,2}\s?(am|pm))\b/i;
  var MONEY_RE = /[$£€]\s?\d[\d,]*(\.\d\d)?/;

  function noteText() {
    var parts = [], body = document.getElementById("bodyIn");
    if (body && body.offsetParent) parts.push(body.innerText);
    document.querySelectorAll(BOX_TEXT).forEach(function (tb) { if (tb.offsetParent) parts.push(tb.innerText); });
    return parts.join("\n");
  }
  function sentencesOf(text) {
    return text.split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.replace(/\s+/g, " ").trim(); })
      .filter(function (s) { return /[a-z]/i.test(s); });
  }
  function short(s, n) { n = n || 60; return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
  function fill(tpl, w) {
    return tpl.replace(/\{w\}/g, w.toLowerCase()).replace(/\{W\}/g, w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  function voice(duck, pilot) { return pick(aviation() && pilot ? pilot : duck); }

  // Everything Pip could say about the text, each with a weight. Quotes carry the sentence,
  // so he can go and stand on it.
  function ideasAbout(text, focus) {
    var ideas = [];
    function add(weight, say, quote) { ideas.push({ w: weight, say: say, quote: quote || null }); }
    var sentences = focus ? [focus] : sentencesOf(text);
    var words = (text.toLowerCase().match(/[a-z][a-z']+/g) || []);
    var total = (text.match(/\S+/g) || []).length;

    if (!focus) {
      if (total === 0) { add(3, voice(["A blank page. The possibilities!", "Nothing here yet. I'll wait."], ["Empty logbook. Ready when you are.", "Clear runway. Start writing!"])); return ideas; }
      if (total >= 300) add(1.5, voice(["{n} words! You're on a roll.", "{n} words. My wings are tired just reading."], ["{n} words logged. Long-haul flight!", "{n} words. That's a transatlantic note."]).replace("{n}", total));
      else if (total < 12) add(0.8, voice(["Short and sweet.", "Brief. I like it."], ["Short hop. Nice."]));
      var boxes = document.querySelectorAll("#bodyIn ul.checklist > li, .thing .tb ul.checklist > li, .cv-item .rt ul.checklist > li, #boxesWrap .rt ul.checklist > li");
      if (boxes.length) {
        var ticked = Array.prototype.filter.call(boxes, function (li) { return li.getAttribute("data-checked") === "true"; }).length;
        add(2, (ticked === boxes.length
          ? voice(["Everything's checked off. Wow!", "All done! Nothing left on the list."], ["Checklist complete. Cleared for takeoff."])
          : voice(["{d} of {t} done. Keep going!", "Checklist: {d}/{t}. You can do it!"], ["Checklist: {d} of {t} complete.", "{r} items left before takeoff."]))
          .replace("{d}", ticked).replace("{t}", boxes.length).replace("{r}", boxes.length - ticked));
      }
      var listLines = text.split("\n").filter(function (l) { return /^\s*([-*•]|\d+[.)])\s+\S/.test(l); }).length;
      if (listLines >= 3) add(2, voice(["{n} things on this list. Busy!", "Lists! I love a good list. {n} items!"], ["{n} items on the checklist.", "Checklist: {n} items. Let's run through it."]).replace("{n}", listLines));
      var counts = {}, best = null;
      words.forEach(function (w) {
        if (STOP[w] || w.length < 4) return;
        counts[w] = (counts[w] || 0) + 1;
        if (!best || counts[w] > counts[best]) best = w;
      });
      if (best && counts[best] >= 3) add(1.5, voice(["You really like the word “{w}”.", "“{w}” — that's {n} times now!"], ["“{w}” is the word of the day, captain.", "Callsign suggestion: “{w}”. You use it {n} times."]).replace("{w}", best).replace("{w}", best).replace("{n}", counts[best]));
      var longest = words.filter(function (w) { return w.length >= 11 && !STOP[w]; }).sort(function (a, b) { return b.length - a.length; })[0];
      if (longest) add(1, voice(["“{w}”! Big word.", "Ooh, “{w}”. Fancy."], ["“{w}” — that's a long runway of a word."]).replace("{w}", longest));
    }

    sentences.forEach(function (s) {
      var q = short(s);
      if (/\?$/.test(s)) add(2, voice(["“" + q + "” Hmm, good question.", "“" + q + "” I'd say yes. Probably.", "“" + q + "” Ask a duck? Okay: quack."],
        ["“" + q + "” Checking with the tower…", "“" + q + "” Stand by for an answer."]), s);
      else if (/!$/.test(s)) add(1.5, voice(["“" + q + "” Exciting!", "“" + q + "” Wow!"], ["“" + q + "” Full throttle!"]), s);
      var d = s.match(DATE_RE);
      if (d) {
        add(2, voice(["Don't forget: “" + q + "”", "I'll remember “" + d[0] + "” for you. (I won't. I'm a duck.)"],
          ["Scheduled departure: “" + q + "”", "Noted for the " + d[0] + " slot."]), s);
        add(1.4, voice(["Want a reminder for “" + d[0] + "”? Right-click that line and pick Remind me.",
                        "I can remind you about that! Right-click the line."],
          ["Want me to file a reminder for " + d[0] + "? Right-click the line.", "Right-click that line and I'll log a reminder."]), s);
      }
      var m = s.match(MONEY_RE);
      if (m) add(1.5, voice([m[0] + "? That's a lot of bread.", m[0] + "! Could buy so many crackers."], [m[0] + " — fuel's not cheap.", m[0] + " logged in the expense report."]), s);
      TOPICS.forEach(function (tp) {
        var hit = s.match(tp[0]);
        if (hit) add(focus ? 3 : 1.8, fill(voice(tp[1], tp[2]), hit[1]), s);
      });
    });
    // A plain quote of a sentence of a reasonable length.
    var quotable = sentences.filter(function (s) { var n = s.split(" ").length; return n >= 4 && n <= 22; });
    if (quotable.length) {
      var s = pick(quotable), q = short(s);
      add(focus ? 0.6 : 1.2, voice(["I like this part: “" + q + "”", "“" + q + "” — well said.", "“" + q + "” Hmm. Deep."],
        ["“" + q + "” — read back correct.", "Copy: “" + q + "”", "“" + q + "” Roger that."]), s);
    }
    return ideas;
  }
  function choose(ideas) {
    var sum = ideas.reduce(function (a, i) { return a + i.w; }, 0), r = Math.random() * sum;
    for (var k = 0; k < ideas.length; k++) { r -= ideas[k].w; if (r <= 0) return ideas[k]; }
    return ideas[ideas.length - 1];
  }

  // Where a sentence is on screen, so he can stand on it.
  function findText(sentence) {
    var probe = sentence.slice(0, 18);
    var roots = [document.getElementById("bodyIn")].concat(Array.prototype.slice.call(document.querySelectorAll(BOX_TEXT)));
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i]) continue;
      var w = document.createTreeWalker(roots[i], NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        var at = n.data.replace(/ /g, " ").indexOf(probe);
        if (at >= 0) {
          var r = document.createRange();
          r.setStart(n, at); r.setEnd(n, Math.min(n.data.length, at + 1));
          var rect = r.getBoundingClientRect();
          if (rect.top > 40 && rect.bottom < viewBottom() - 10 && rect.left >= 0 && rect.left < window.innerWidth) return rect;
          return null;
        }
      }
    }
    return null;
  }

  var lastComment = -1e9, lastAi = -1e9, aiBusy = false;
  // Now and then (every few minutes at most), his remark comes from PIP's AI on this computer.
  // The app decides whether that's a good moment (AI on and ready, you're not mid-typing).
  function aiComment(stay) {
    if (typeof cfg.aiLine !== "function" || aiBusy || now() - lastAi < 150000) return false;
    aiBusy = true; lastAi = now(); lastComment = now();
    var kind = pick(["comment", "comment", "quote", "idea"]);
    cfg.aiLine(kind).then(function (text) {
      aiBusy = false;
      if (!text) { lastAi = now() - 120000; return; }   // not now: try again a bit sooner
      if (!enabled || P.held || P.state === "sleep") return;
      say(text, Math.min(6500, 2400 + text.length * 45));
    }, function () { aiBusy = false; });
    if (!stay) idle(1500);
    return true;
  }
  // stay: say it from where he is (he's in bed) instead of walking over to the sentence.
  function comment(focus, stay) {
    stay = stay || !!P.bed;
    if (!focus && Math.random() < 0.5 && aiComment(stay)) return stay ? null : undefined;
    var text = noteText();
    if (!text && !document.getElementById("bodyIn")) return stay ? null : idle(1500);
    var idea = choose(ideasAbout(text, focus));
    if (!idea) return stay ? null : idle(1500);
    lastComment = now();
    if (!stay) P.state = "comment";
    var spot = idea.quote && !stay ? findText(idea.quote) : null;
    function speak() {
      if (!stay) P.sitting = !!spot;
      P.until = now() + 3600;
      say(idea.say, Math.min(5200, 2200 + idea.say.length * 40));
    }
    if (spot) goTo(spot.left - 6, spot.top - SIZE + 6, function () { P.facing = 1; speak(); });
    else { P.onArrive = null; speak(); }
  }

  // The sentence you just finished, up to the cursor.
  function justWritten() {
    var a = document.activeElement, sel = window.getSelection();
    if (!a || !a.isContentEditable || !sel.rangeCount) return null;
    var r = document.createRange();
    r.selectNodeContents(a);
    r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    var before = r.toString().replace(/\s+/g, " ").trim();
    var m = before.match(/[^.!?]*[.!?]$/);
    var s = m && m[0].trim();
    return s && s.split(" ").length >= 3 ? s : null;
  }

  // ---------- Playing with buttons ----------

  // Shove a toolbar button sideways, lift it overhead, or pick it up and throw it.
  function nudge() {
    if (typing()) return idle(2000);
    var btns = Array.prototype.filter.call(
      document.querySelectorAll(MOBILE ? "#fmt button, .screen:not([hidden]) .top .icon, #newBtn"
                                       : ".fmt .fb:not(:disabled), .fmt .fsel, .bar .btn, #newBtn, .side-foot .btn"),
      function (b) { return visible(b); });
    if (!btns.length) return wander();
    var b = pick(btns), r = b.getBoundingClientRect();
    var canLift = r.bottom + SIZE + 12 < viewBottom();
    // Sidebar buttons sit in a clipped panel, so those only ever get shoved.
    var inSidebar = !!b.closest(".side");
    var roll = Math.random();
    P.state = "nudge";
    if (canLift && !inSidebar && !reduce && !MOBILE && roll < 0.3) return throwButton(b, r);
    if (canLift && roll < 0.6) return liftButton(b, r, Math.random() < 0.6);
    var fromLeft = r.left - SIZE + 12 > 4;
    goTo(fromLeft ? r.left - SIZE + 12 : r.right - 12, r.bottom - SIZE + 4, function () {
      var dir = fromLeft ? 1 : -1;
      P.facing = dir;
      flyCopy(b, [{ transform: "none" }, { transform: "translateX(" + 22 * dir + "px) rotate(" + 8 * dir + "deg)", offset: 0.3 },
                  { transform: "translateX(" + 15 * dir + "px) rotate(" + 3 * dir + "deg)", offset: 0.6 }, { transform: "none" }],
              { duration: 850, easing: "cubic-bezier(.3,1.5,.5,1)" }, fromLeft ? "pip-push" : "pip-push-left");
      bounce();
      if (Math.random() < 0.4) say(line("push"), 1400);
      idle(1300 + Math.random() * 1500);
    });
  }

  // Button tricks animate a stand-in copy floating above everything, because the toolbars
  // clip their own buttons (they slide). The real button hides until the copy is done.
  function flyCopy(b, frames, opts, cls) {
    var r = b.getBoundingClientRect();
    var c = b.cloneNode(true);
    c.removeAttribute("id");
    c.querySelectorAll("[id]").forEach(function (x) { x.removeAttribute("id"); });
    c.setAttribute("aria-hidden", "true");
    c.classList.add("pip-flying-copy");
    if (cls) c.classList.add(cls);
    c.style.left = r.left + "px"; c.style.top = r.top + "px";
    c.style.width = r.width + "px"; c.style.height = r.height + "px";
    document.body.appendChild(c);
    b.style.visibility = "hidden";
    var anim = c.animate(frames, opts);
    function done() { c.remove(); b.style.visibility = ""; }
    anim.onfinish = done;
    anim.oncancel = done;
    return anim;
  }

  // Get under a button and hold it overhead for a moment.
  function liftButton(b, r, talk) {
    goTo(r.left + r.width / 2 - SIZE / 2, r.bottom - 6, function () {
      P.facing = Math.random() < 0.5 ? 1 : -1;
      play("lifting", 1300);
      flyCopy(b, [{ transform: "none" }, { transform: "translateY(-13px) rotate(-3deg)", offset: 0.2 }, { transform: "translateY(-14px) rotate(3deg)", offset: 0.38 },
                  { transform: "translateY(-13px) rotate(-2deg)", offset: 0.55 }, { transform: "translateY(1px)", offset: 0.75 },
                  { transform: "translateY(-3px)", offset: 0.86 }, { transform: "none" }],
              { duration: 1350, easing: "ease-in-out" }, "pip-lift");
      // Talk above the lifted button so the bubble doesn't cover it.
      if (talk) say(line("lift"), 1500, { left: r.left, right: r.right, top: r.top - 16 });
      idle(1700 + Math.random() * 1200);
    });
  }

  // Lift the button, hurl it spinning across the screen, go after it; it zips back on its own.
  // It's only a visual trick (a transform), so the toolbar never actually changes.
  function throwButton(b, r) {
    goTo(r.left + r.width / 2 - SIZE / 2, r.bottom - 6, function () {
      var W = window.innerWidth, H = window.innerHeight;
      var dir = r.left + r.width / 2 < W / 2 ? 1 : -1;
      var dx = dir * (260 + Math.random() * 360);
      dx = Math.max(12 - r.left, Math.min(W - r.right - 12, dx));          // stay on screen
      var land = Math.min(H - r.bottom - 16, 60 + Math.random() * 200);
      var peak = -Math.min(r.top - 8, 70 + Math.random() * 70);
      var spin = dir * (Math.random() < 0.5 ? 360 : 720);
      P.facing = dir;
      play("lifting", 1300);
      flyCopy(b, [
        { transform: "none", offset: 0 },
        { transform: "translateY(-14px) rotate(-4deg)", offset: 0.14 },
        { transform: "translateY(-16px) rotate(4deg)", offset: 0.26, easing: "cubic-bezier(.3,.6,.4,1)" },
        { transform: "translate(" + dx * 0.5 + "px," + peak + "px) rotate(" + spin * 0.5 + "deg)", offset: 0.42, easing: "cubic-bezier(.5,0,.8,.6)" },
        { transform: "translate(" + dx + "px," + land + "px) rotate(" + spin + "deg)", offset: 0.58 },
        { transform: "translate(" + (dx - dir * 6) + "px," + (land - 8) + "px) rotate(" + (spin - dir * 8) + "deg)", offset: 0.63 },
        { transform: "translate(" + dx + "px," + land + "px) rotate(" + spin + "deg)", offset: 0.68 },
        { transform: "translate(" + dx + "px," + land + "px) rotate(" + spin + "deg)", offset: 0.8, easing: "cubic-bezier(.6,0,.3,1)" },
        { transform: "none", offset: 1 }
      ], { duration: 3000 }, "pip-thrown");
      setTimeout(function () {
        bounce();
        say(line("throw"), 1600, { left: r.left, right: r.right, top: r.top - 18 });
        // Waddle (or fly) after it.
        var bx = r.left + dx + r.width / 2, by = r.top + land;
        P.look = { x: bx, y: by };
        setTimeout(function () {
          goTo(bx - dir * (SIZE + 6) - SIZE / 2 + SIZE / 2, by + r.height - SIZE + 4, function () {
            P.facing = dir;
            if (Math.random() < 0.4) say(line("fetch"), 1500);
            idle(1500 + Math.random() * 1500);
          });
        }, 500);
      }, 800);
    });
  }

  function caretRect() {
    var a = document.activeElement;
    if (!a || !a.isContentEditable) return null;
    var sel = window.getSelection();
    if (!sel.rangeCount) return null;
    var r = sel.getRangeAt(0).cloneRange();
    r.collapse(false);
    var rects = r.getClientRects(), rect = rects[rects.length - 1];
    if (!rect || (!rect.width && !rect.height && !rect.left)) {
      var node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      rect = node.getBoundingClientRect();
    }
    if (rect.top < 30 || rect.top > window.innerHeight - 20 || rect.left < 0 || rect.left > window.innerWidth) return null;
    return { left: rect.left, top: rect.top };
  }
  // Keep you company on the line you're typing, for a few seconds at a time.
  var lastPerchEnd = -1e9;
  function perchAt(r, keepUntil) {
    if (P.bed === "rest") leaveBed();   // resting on his own: he'll get up to join you
    if (P.state !== "perch" || !keepUntil) P.until = now() + 4000 + Math.random() * 4000;
    P.state = "perch";
    P.anchor = r;
    // Stand on the line just above where you're typing, a little behind the cursor.
    goTo(r.left - SIZE * 0.8, r.top - SIZE + 6, function () { P.sitting = true; P.facing = 1; });
  }
  function endPerch(t) {
    lastPerchEnd = t;
    P.sitting = false;
    idle(400);
  }

  // ---------- His bed ----------
  // A cozy spot in the top right. He goes there to rest (and to nap when you're away).
  // If you drag him into it, he stays until you drag him out, but he still chats from there.

  function bedRect() {
    var b = document.getElementById("pipBed");
    if (!b || b.hidden || (!b.offsetParent && getComputedStyle(b).position !== "fixed")) return null;   // the phone's house is fixed in place
    var r = b.getBoundingClientRect();
    return r.width ? r : null;
  }
  // On a phone he sits down inside the little nest (his feet a bit below its rim).
  function bedSpot(r) { return { x: r.left + r.width / 2 - SIZE / 2, y: MOBILE ? r.top + r.height * 0.78 - SIZE : Math.max(4, r.bottom - SIZE - 4) }; }
  function goToBed(mode, then) {
    var r = bedRect();
    if (!r) return false;
    var s = bedSpot(r);
    P.state = "bed";
    P.bed = mode;               // "rest" (his own idea) or "locked" (you put him there)
    P.until = 0;
    function arrive() { P.walkOnly = false; P.inBed = true; P.sitting = true; P.facing = -1; if (then) then(); }
    if (!MOBILE) { goTo(s.x, s.y, arrive); return true; }
    // Phone: get to a spot below the house, then walk up to the door, shrinking as he goes.
    goTo(s.x, s.y + FAR, function () {
      if (P.bed !== mode) return;
      P.walkOnly = true;
      P.tx = s.x; P.ty = s.y; P.onArrive = arrive;   // the door can be above where goTo would allow
    });
    return true;
  }
  function leaveBed() {
    var wasIn = P.inBed;
    P.bed = null; P.inBed = false; P.napping = false; P.sitting = false;
    if (MOBILE && wasIn && !P.held) {   // walk back out of the door towards you, growing as he comes
      P.walkOnly = true; P.state = "exit";
      P.tx = P.x; P.ty = clampY(P.y + FAR); P.onArrive = function () { P.walkOnly = false; idle(800); };
    }
  }
  function rest() {
    if (!goToBed("rest")) return idle(1500);
    P.bedUntil = now() + 15000 + Math.random() * 25000;
    if (Math.random() < 0.6) say(line("rest"), 2200);
  }
  function bedThink(t) {
    var r = bedRect();
    if (!r) { leaveBed(); return idle(800); }
    if (P.inBed) { var s = bedSpot(r); P.tx = s.x; P.ty = s.y; }   // stay in it if the window changes size
    if (P.onArrive || t < P.until) return;
    if (P.bed === "rest" && t > P.bedUntil) {
      leaveBed();
      if (Math.random() < 0.5) say(line("bedLeave"), 1800);
      return idle(800);
    }
    var roll = Math.random();
    if (roll < 0.35) { P.napping = true; P.until = t + 10000 + Math.random() * 15000; return; }
    P.napping = false;
    if (roll < 0.6) { comment(undefined, true); P.until = t + 6000 + Math.random() * 4000; }
    else if (roll < 0.75) { say(line("bedIdle"), 2600); P.until = t + 6000; }
    else { P.look = { x: r.left - 200 + Math.random() * 150, y: r.top + Math.random() * 300 }; P.until = t + 3000 + Math.random() * 4000; }
  }

  function sleep() {
    // Sleepy: off to bed for a proper nap if there is one.
    if (goToBed(P.bed || "rest", function () { P.napping = true; P.deepSleep = true; })) {
      P.bedUntil = 1e15;
      P.until = 1e15;
      return;
    }
    P.state = "sleep";
    P.sitting = true;
    goTo(P.x, P.y);
  }
  function wake() {
    if (P.bed) {
      P.napping = false;
      P.until = now() + 2000;
      if (P.bed === "rest") P.bedUntil = now() + 2500;   // gets up shortly
      say(line("wake"), 1800);
      return;
    }
    P.sitting = false;
    idle(900);
    say(line("wake"), 1800);
  }

  // ---------- Being picked up ----------

  var held = null;
  function overBed(e, r) { return e.clientX > r.left - 24 && e.clientX < r.right + 24 && e.clientY > r.top - 36 && e.clientY < r.bottom + 24; }
  function onPipDown(e) {
    if (e.button !== 0 || !enabled) return;
    e.preventDefault();
    e.stopPropagation();
    held = { sx: e.clientX, sy: e.clientY, ox: e.clientX - P.x, oy: e.clientY - P.y, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function onPipMove(e) {
    if (!held) return;
    if (!held.moved && Math.hypot(e.clientX - held.sx, e.clientY - held.sy) < 4) return;
    if (!held.moved) {
      held.moved = true;
      P.held = true;
      P.onArrive = null; P.forceFly = false; P.napping = false; P.inBed = false; P.sitting = false;
      if (Math.random() < 0.6) say(line("held"), 1400);
    }
    P.x = P.tx = clampX(e.clientX - held.ox);
    P.y = P.ty = clampY(e.clientY - held.oy);
    var r = bedRect(), b = document.getElementById("pipBed");
    if (b) b.classList.toggle("drop-ready", !!(r && overBed(e, r)));
  }
  function onPipUp(e) {
    if (!held) return;
    var h = held;
    held = null;
    P.held = false;
    var b = document.getElementById("pipBed");
    if (b) b.classList.remove("drop-ready");
    activity();
    if (!h.moved) {   // just a click
      bounce();
      say(line(P.bed ? "bedPoke" : "poke"), 1600);
      return;
    }
    var r = bedRect();
    if (r && overBed(e, r)) {
      var already = P.bed === "locked";
      goToBed("locked");
      if (!already) say(line("bedIn"), 2600);
    } else {
      if (P.bed) say(line("bedOut"), 2000);
      leaveBed();
      idle(1500);
    }
  }

  function decide(t) {
    // Phone, while you type: stay out of the way along the top, or go and rest.
    if (typing()) {
      var r2 = Math.random();
      if (r2 < 0.2) return rest();
      if (r2 < 0.5) return edgeWander();
      if (r2 < 0.6 && t - lastComment > 30000) { comment(undefined, true); return idle(3000); }
      return idle(2500 + Math.random() * 3000);
    }
    // While you type he only sometimes comes to sit with you, and not again for a while after.
    if (!MOBILE && t - lastKey < 2500 && t - lastPerchEnd > 25000 && Math.random() < 0.35) {
      var r = caretRect();
      if (r) return perchAt(r);
    }
    var roll = Math.random();
    if (roll < 0.10 && t - mouse.t < 4000) {  // only now and then: chase the cursor
      P.state = "chase";
      P.until = t + 2000 + Math.random() * 1800;
    }
    else if (roll < 0.30) nudge();
    else if (roll < 0.48) wander();
    else if (roll < 0.58) visitThing();
    else if (roll < 0.70) comment();
    else if (roll < 0.78) trick();
    else if (roll < 0.83) readTitle();
    else if (roll < 0.88) preen();
    else if (roll < (outfit && outfit.time === "night" ? 0.98 : 0.92)) rest();   // more rest at night
    else idle(2000 + Math.random() * 4000);
  }

  function think(t) {
    if (P.held) return;
    if (P.bed) return bedThink(t);
    if (P.state === "sleep") return;
    // Pajama-time Pip dozes off much sooner.
    var sleepAfter = outfit && outfit.time === "night" ? 20000 : SLEEP_AFTER;
    if (t - lastActivity > sleepAfter && !P.onArrive && P.state !== "announce") return sleep();
    if (P.state === "chase") {
      if (t > P.until || t - mouse.t > 2500) return idle(1200);
      // Keep just beside the cursor, on whichever side Pip is coming from.
      var left = P.x + SIZE / 2 > mouse.x;
      goTo(left ? mouse.x + 18 : mouse.x - SIZE - 18, mouse.y - SIZE + 12);
      return;
    }
    if (P.state === "perch") {
      var r = caretRect();
      if (!r || t - lastKey > 6000 || t > P.until) return endPerch(t);
      // Only move along if you've gone to another line, not with every letter.
      if (Math.abs(r.top - P.anchor.top) > 8) perchAt(r, true);
      return;
    }
    if (!P.onArrive && t > P.until) decide(t);
  }

  function move(dt) {
    var dx = P.tx - P.x, dy = P.ty - P.y, d = Math.hypot(dx, dy);
    if (d < 1.5) {
      P.x = P.tx; P.y = P.ty;
      P.moving = false;
      if (!P.forceFly) P.flying = false;
      var cb = P.onArrive; P.onArrive = null;
      if (cb) cb();
      return;
    }
    P.moving = true;
    if (P.forceFly) P.flying = true;
    else if (P.walkOnly) P.flying = false;
    else if (!P.flying && (d > 260 || Math.abs(dy) > 110) && P.state !== "chase") P.flying = true;
    else if (P.flying && d < 30) P.flying = false;
    var speed = P.forceFly ? 300 : P.flying ? 470 : P.state === "chase" ? 240 : 130;
    if (P.walkOnly) speed = 75 + 55 * farScale();   // little steps in the distance
    if (reduce) speed *= 0.6;
    var step = Math.min(d, speed * dt);
    P.x += dx / d * step; P.y += dy / d * step;
    if (Math.abs(dx) > 3) P.facing = dx > 0 ? 1 : -1;
  }

  // Phone: near his little house he's smaller, as if far away (it's up the screen, in the distance).
  function farScale() {
    if (!MOBILE || P.held) return 1;
    var r = bedRect();
    if (!r) return 1;
    var d = Math.hypot(P.x + SIZE / 2 - (r.left + r.width / 2), P.y + SIZE - (r.top + r.height * 0.78));
    return d >= FAR ? 1 : NEST_SCALE + (1 - NEST_SCALE) * d / FAR;
  }
  var NEST_SCALE = 0.36;   // his size in the nest: small, but you can still see him
  function render(t) {
    var sc = farScale();
    el.style.transform = "translate3d(" + P.x.toFixed(1) + "px," + P.y.toFixed(1) + "px,0)" + (sc < 1 ? " scale(" + sc.toFixed(3) + ")" : "");
    el.classList.toggle("in-nest", MOBILE && !!P.inBed && !P.held);
    flip.style.transform = P.facing < 0 ? "scaleX(-1)" : "";
    el.classList.toggle("walking", P.moving && !P.flying);
    el.classList.toggle("flying", P.flying);
    el.classList.toggle("sitting", !P.moving && !P.held && (P.sitting || P.inBed || P.state === "sleep"));
    el.classList.toggle("sleeping", P.state === "sleep" || (P.napping && !P.held && !P.moving));
    el.classList.toggle("held", !!P.held);
    el.classList.toggle("in-bed", !!P.inBed);
    zzz.textContent = "z" + (Math.floor(t / 800) % 2 ? "Z" : "");

    // Eyes follow the cursor when it's about, otherwise where he's heading or glancing.
    var look = t - mouse.t < 3000 ? mouse : P.moving ? { x: P.tx + SIZE / 2, y: P.ty + SIZE / 2 } : P.look;
    if (look && pupil) {
      var ex = P.x + (P.facing > 0 ? 46 : 18) * SIZE / 64, ey = P.y + 23.5 * SIZE / 64;
      var vx = look.x - ex, vy = look.y - ey, len = Math.hypot(vx, vy) || 1;
      pupil.setAttribute("transform", "translate(" + (vx / len * 1.3 * P.facing).toFixed(2) + " " + (vy / len * 1.3).toFixed(2) + ")");
    }
    if (bubble.classList.contains("show")) {
      var bw = bubble.offsetWidth, bh = bubble.offsetHeight, a = bubbleAnchor, bx, by, hr;
      if (MOBILE && P.inBed && !a && (hr = bedRect())) {
        // Phone: talking from his little nest, just under it.
        bubble.style.maxWidth = "";
        bx = hr.left + hr.width / 2 - bw / 2;
        by = hr.bottom + 8;
      } else if (P.inBed && !a) {
        // In bed (in his nook): talk just above the bed, inside the nook, so the toolbar
        // buttons stay clear.
        var nook = document.getElementById("pipNook"), nr = nook && !nook.hidden ? nook.getBoundingClientRect() : null;
        bubble.style.maxWidth = nr ? Math.max(110, nr.width - 8) + "px" : "";
        bw = bubble.offsetWidth; bh = bubble.offsetHeight;
        bx = nr ? nr.left + (nr.width - bw) / 2 : P.x + SIZE / 2 - bw / 2;
        by = P.y - bh + 2;
      } else if (a) {
        bubble.style.maxWidth = "";
        bx = (a.left + a.right) / 2 - bw / 2;
        by = a.top - bh - 6;
        if (by < 6) { bx = a.right + 10; by = Math.max(6, a.top); }   // no room above: beside it instead
      } else {
        bubble.style.maxWidth = "";
        bx = P.x + SIZE / 2 - bw / 2;
        by = P.y - bh - 4;
      }
      bubble.style.transform = "translate(" + Math.max(6, Math.min(window.innerWidth - bw - 6, bx)) + "px," + Math.max(6, by) + "px)";
    }
  }

  var outfit = null, lastOutfitCheck = 0, lastSlow = 0;
  // ---------- Wardrobe: picking an outfit yourself ----------

  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var SEASON_MONTH = { winter: 0, spring: 3, summer: 6, autumn: 8 };
  var HOLIDAY_DATES = {
    newyear: [1, 1, "New Year"], valentine: [2, 14, "Valentine's Day"], stpatrick: [3, 17, "St. Patrick's Day"],
    aprilfools: [4, 1, "April Fools"], easter: [0, 0, "Easter"], pipday: [10, 15, "Pip's birthday"], halloween: [10, 31, "Halloween"],
    thanksgiving: [11, 0, "Thanksgiving"], christmas: [12, 25, "Christmas"], nye: [12, 31, "New Year's Eve"]
  };
  var WARDROBE = [{ id: "auto", label: "Automatic", group: "Changes on its own" }, { id: "classic", label: "Classic pilot", group: "Changes on its own" }]
    .concat(["winter", "spring", "summer", "autumn"].map(function (s) { return { id: "season:" + s, label: s[0].toUpperCase() + s.slice(1), group: "Seasons" }; }))
    .concat(DAY_NAMES.map(function (d, i) { return { id: "day:" + i, label: d, group: "Days of the week" }; }))
    .concat(Object.keys(HOLIDAY_DATES).map(function (h) { return { id: "holiday:" + h, label: HOLIDAY_DATES[h][2], group: "Holidays" }; }))
    .concat([{ id: "pajamas", label: "Pajamas", group: "Any time" }, { id: "lunch", label: "Lunch bib", group: "Any time" }]);

  // A plain day (no holiday) in a given month that falls on a given weekday, at 10 AM.
  function plainDay(year, month, weekday) {
    for (var d = 2; d <= 28; d++) {
      var x = new Date(year, month, d, 10, 0);
      if (x.getDay() === weekday && !holidayOn(x)) return x;
    }
    return new Date(year, month, 2, 10, 0);
  }
  function outfitForChoice(choice, base) {
    base = base || new Date();
    var y = base.getFullYear();
    if (!choice || choice === "auto") return cfg.outfits ? computeOutfit(base) : null;
    if (choice === "classic") return null;
    // Season and holiday looks are shown on their own, without the weekday's extra prop.
    function only(o) { o.props = o.props.filter(function (p) { return DAY_PROPS.indexOf(p) === -1; }); o.key = [o.hat, o.props.join(","), o.shades, o.scarf].join("|"); return o; }
    if (choice.indexOf("season:") === 0) return only(computeOutfit(plainDay(y, SEASON_MONTH[choice.slice(7)], base.getDay())));
    if (choice.indexOf("day:") === 0) return computeOutfit(plainDay(y, base.getMonth(), +choice.slice(4)));
    if (choice.indexOf("holiday:") === 0) {
      var h = choice.slice(8), when = HOLIDAY_DATES[h];
      var d = h === "easter" ? new Date(y, easterOf(y)[0] - 1, easterOf(y)[1], 10)
        : h === "thanksgiving" ? (function () { for (var i = 22; i <= 28; i++) { var t = new Date(y, 10, i, 10); if (t.getDay() === 4) return t; } })()
        : new Date(y, when[0] - 1, when[1], 10);
      return only(computeOutfit(d));
    }
    var at = new Date(base);
    if (choice === "pajamas") at.setHours(23, 0, 0, 0);
    if (choice === "lunch") { at.setHours(0, minsOf(cfg.lunchTime) + 5, 0, 0); }
    return computeOutfit(at);
  }
  function dress(target, o) {
    if (!o) {
      delete target.dataset.hat; delete target.dataset.props; delete target.dataset.shades;
      target.style.removeProperty("--pip-scarf");
      return;
    }
    target.dataset.hat = o.hat;
    target.dataset.props = o.props.join(" ");
    if (o.shades) target.dataset.shades = ""; else delete target.dataset.shades;
    target.style.setProperty("--pip-scarf", o.scarf);
  }
  // A still picture of Pip in an outfit, for the wardrobe.
  function thumb(choice) {
    if (!document.getElementById("pip-style")) {
      var st = document.createElement("style");
      st.id = "pip-style"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var t = document.createElement("div");
    t.className = "pip-duck pip-thumb";
    t.setAttribute("aria-hidden", "true");
    t.innerHTML = '<div class="flip">' + SVG + "</div>";
    dress(t, choice === "auto" ? outfitForChoice("auto") || null : outfitForChoice(choice));
    return t;
  }

  function applyOutfit(announceChange) {
    if (!el) return;
    var choice = cfg.outfitChoice || "auto";
    var when = cfg.date ? new Date(cfg.date) : new Date();
    var o = choice === "auto" && cfg.date ? computeOutfit(when) : outfitForChoice(choice, when), prev = outfit;
    outfit = o;
    dress(el, o);
    if (announceChange && prev && o && prev.key !== o.key && choice === "auto") { var l = outfitLine(o, prev); if (l) say(l, 3400); }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - lastOutfitCheck > 60000) { lastOutfitCheck = t; applyOutfit(true); }
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (document.hidden) return;
    // Phone: tucked away in his house, he only needs a look a couple of times a second (saves battery).
    if (MOBILE && P.inBed && !P.held && !(bubble && bubble.classList.contains("show")) && t - lastSlow < 500) return;
    lastSlow = t;
    think(t);
    move(dt);
    render(t);
  }

  // ---------- What he notices ----------

  function activity() {
    lastActivity = now();
    // Wakes from a proper sleep (a nap you put him down for in bed carries on).
    if (enabled && (P.state === "sleep" || P.deepSleep)) { P.deepSleep = false; wake(); }
  }
  window.addEventListener("mousemove", function (e) {
    mouse = { x: e.clientX, y: e.clientY, t: now() };
    activity();
  }, { passive: true });
  window.addEventListener("keydown", function (e) {
    lastKey = now();
    activity();
    if (!enabled) return;
    if (P.state === "perch" && !P.moving) bounce();
    // Finishing a sentence sometimes gets a reaction to that sentence.
    if ((e.key === "." || e.key === "!" || e.key === "?") && now() - lastComment > 20000 && Math.random() < 0.25) {
      setTimeout(function () {
        var s = justWritten();
        if (enabled && s && P.state !== "sleep") comment(s);
      }, 500);
    }
  }, true);
  // Phone keyboards don't always send key presses, so typing itself counts too.
  if (MOBILE) window.addEventListener("input", function (e) {
    lastKey = now();
    activity();
    if (!enabled || !/[.!?]$/.test(e.data || "") || now() - lastComment < 20000 || Math.random() > 0.25) return;
    setTimeout(function () {
      var s = justWritten();
      if (enabled && s && P.state !== "sleep") comment(s, true);   // said from where he is: never on your line
    }, 500);
  }, true);
  // Clicking right where he stands makes him hop out of the way (the click still goes through).
  window.addEventListener("pointerdown", function (e) {
    if (MOBILE) mouse = { x: e.clientX, y: e.clientY, t: now() };   // he glances at where you tap
    activity();
    if (!enabled || P.bed || P.held || (e.target.closest && e.target.closest("#pip"))) return;
    var cx = P.x + SIZE / 2, cy = P.y + SIZE / 2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < 34) {
      var away = e.clientX < cx ? 1 : -1;
      P.state = "idle"; P.forceFly = false;
      goTo(P.x + away * 80, P.y - 12, function () { idle(1500); });
      bounce();
      if (Math.random() < 0.4) say(line("startled"), 1300);
    }
  }, true);
  window.addEventListener("pip", function (e) {
    var type = e.detail && e.detail.type;
    if (enabled && type === "open-note") {
      // Sometimes he has something to say about the note you just opened.
      if (Math.random() < 0.4 && now() - lastComment > 15000) setTimeout(function () { if (enabled && P.state !== "sleep") comment(); }, 1500);
      return;
    }
    if (!enabled || !(LINES[type] || AV_LINES[type])) return;
    activity();
    if (type === "check" && Math.random() < 0.5) return;   // not every single tick
    say(line(type));
    if (type === "all-done") play("spin", 720); else bounce();
  });
  window.addEventListener("resize", function () { if (!P.inBed && !P.walkOnly) { P.tx = clampX(P.tx); P.ty = clampY(P.ty); } });
  // Phone: when the keyboard opens he hops up out of its way.
  if (MOBILE && window.visualViewport) visualViewport.addEventListener("resize", function () {
    if (!enabled || P.inBed || P.walkOnly || P.held) return;
    if (P.y > clampY(P.y) + 1 || P.ty > clampY(P.ty) + 1) { P.onArrive = null; goTo(P.x, clampY(P.y), function () { idle(1200); }); }
  });
  window.addEventListener("pointermove", function (e) { if (held) onPipMove(e); }, true);
  window.addEventListener("pointerup", function (e) { if (held) onPipUp(e); }, true);

  // ---------- On / off ----------

  function enable() {
    if (enabled) return;
    enabled = true;
    build();
    // Fly in from the left edge.
    P.x = -SIZE; P.y = window.innerHeight * 0.55; P.facing = 1; P.state = "arrive"; P.forceFly = false;
    goTo(110 + Math.random() * 160, window.innerHeight - SIZE - 40, function () { idle(2500); });
    P.flying = true;
    lastOutfitCheck = now();
    applyOutfit(false);
    if (!greeted) {
      greeted = true;
      // Mention today's outfit when he arrives (holiday, bedtime, lunch, or the day of the week).
      setTimeout(function () { say(outfit ? (outfitLine(outfit, null) || line("hello")) : line("hello"), 3200); }, 700);
    }
    last = now();
    raf = requestAnimationFrame(frame);
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    cancelAnimationFrame(raf);
    clearTimeout(bubbleTimer);
    if (el) el.remove();
    if (bubble) bubble.remove();
    el = bubble = null;
  }

  window.Pip = {
    enable: enable,
    disable: disable,
    say: say,
    // For tests and curiosity: where he is and what he's up to.
    configure: function (c) {
      var before = (cfg.outfits ? 1 : 0) + "|" + (cfg.outfitChoice || "auto");
      for (var k in c) cfg[k] = c[k];
      applyOutfit(false);
      var after = (cfg.outfits ? 1 : 0) + "|" + (cfg.outfitChoice || "auto");
      if (enabled && before !== after && outfit) say(cfg.outfitChoice && cfg.outfitChoice !== "auto" ? line("newOutfit") : outfitLine(outfit, null) || line("hello"), 3000);
    },
    announce: announce,
    wardrobe: function () { return WARDROBE.slice(); },
    thumb: thumb,
    // His bed: put him in (he stays until you take him out) or let him out.
    putInBed: function () { if (enabled) { goToBed("locked"); say(line("bedIn"), 2400); } },
    letOut: function () { if (enabled && P.bed) { leaveBed(); say(line("bedOut"), 2000); idle(800); } },
    inBed: function () { return !!P.bed; },
    // For tests: the outfit for a given date, and dressing him as if it were that date.
    outfitFor: function (when) { return computeOutfit(new Date(when)); },
    dressFor: function (when) { cfg.date = when; applyOutfit(false); return outfit && outfit.key; },
    status: function () {
      return { enabled: enabled, x: Math.round(P.x), y: Math.round(P.y), state: P.state, moving: P.moving, flying: P.flying, sitting: P.sitting,
               bed: P.bed || null, inBed: !!P.inBed, napping: !!P.napping, held: !!P.held };
    },
    // For tests: make him do one of his activities now.
    act: function (name, arg) {
      var acts = {
        nudge: nudge, wander: wander, visit: visitThing, trick: trick, read: readTitle, preen: preen, comment: comment,
        perch: function () { var r = caretRect(); if (r) perchAt(r); },
        lift: function () {
          var b = document.querySelector(".fmt .fb:not(:disabled)"), r = b && visible(b);
          if (r) { P.state = "nudge"; liftButton(b, r, true); }
        },
        "throw": function () {
          var b = document.querySelector(".fmt .fb:not(:disabled)"), r = b && visible(b);
          if (r) { P.state = "nudge"; throwButton(b, r); }
        }
      };
      if (enabled && acts[name]) { if (P.bed === "rest") leaveBed(); P.onArrive = null; acts[name](arg); }
    },
    // For tests: what he might say about some text (duck or pilot voice follows the setting).
    ideas: function (text, focus) { return ideasAbout(text, focus).map(function (i) { return i.say; }); },
    line: line
  };
})();
