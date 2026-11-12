// App Store screenshot panels. ONE story, the same eight panels in the same order on iPhone and iPad:
// what sets MainLine apart first (prep for your next opponent from their real games; your repertoire
// checked against your own games), then choosing moves, fixing weak spots, the guide, memory, the
// coach, the daily habit. Backgrounds are one brand family (template.html), alternated on purpose:
// brand blue, mist, ink navy, sky, brand blue, mist, ink navy, sky.
//
// Each panel: `color`, a serif `headline` with ONE <em> word the swash goes under (`swash: "loop"`
// adds a flick), one plain `sub`, and `shot`, a raw simulator screenshot (capture.sh) inside a
// drawn device. Copy rules: say only what the app does today, plain words, no prices, no other
// companies' names (Lichess is named in the app because it is built on its data). The coach is AI:
// say what it explains, promise nothing about results.

window.CANVAS = {
  ipad: { width: 2064, height: 2752 },   // iPad 13-inch
  iphone: { width: 1320, height: 2868 }  // iPhone 6.9-inch
};

// iPad scenes whose raw shot is the 1.3x-larger one (capture.sh z-*): the lists. The line editor's board scenes stay at 1x.
const ZOOMED = ["opponent", "games", "focus", "stats", "coach", "today"];

const STORY = [
  { n: "01-opponent", color: "brand", shot: "opponent", swash: "loop",
    headline: "Prep for your<br>next <em>opponent</em>",
    sub: "Enter their username and see the openings they really play, and the ones you have no answer for." },
  { n: "02-games", color: "mist", shot: "games",
    headline: "See where your<br><em>prep</em> breaks",
    sub: "Import your games and find the exact move each one left your repertoire." },
  { n: "03-build", color: "ink", shot: "build", swash: "loop",
    headline: "Choose moves<br>that <em>score</em>",
    sub: "See how each reply does at your rating, next to master games and an engine check." },
  { n: "04-focus", color: "sky", shot: "focus",
    headline: "Fix your<br><em>weak spots</em> first",
    sub: "Your weakest moves, openings and lines, from your training and your own games." },
  { n: "05-guide", color: "brand", shot: "guide",
    headline: "A guide at<br><em>every</em> move",
    sub: "Strong, popular choices for whoever is to move, each labelled with why it is there.", swash: "loop" },
  { n: "06-memory", color: "mist", shot: "stats",
    headline: "Remember<br>every <em>line</em>",
    sub: "Each position comes back just before you would forget it, and you see how well it has stuck." },
  { n: "07-coach", color: "ink", shot: "coach",
    headline: "Ask your coach <em>why</em>",
    sub: "Plain-language explanations of the idea behind a move, from the engine and the game statistics." },
  { n: "08-today", color: "sky", shot: "today",
    headline: "A few minutes<br>a <em>day</em>",
    sub: "See what is due and keep your streak going. Free, no ads, and it works offline.", swash: "loop" }
];

window.PANELS = [].concat(...["ipad", "iphone"].map((device) =>
  STORY.map((p, i) => ({
    id: `${device}-0${i + 1}`, device, file: `${device}/${p.n}.png`, color: p.color,
    headline: p.headline, sub: p.sub, swash: p.swash,
    shot: `${device === "ipad" ? (ZOOMED.includes(p.shot) ? "z" : "t") : "p"}-${p.shot}.png`
  }))
));
