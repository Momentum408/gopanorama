const select = (selector) => document.querySelector(selector);
const all = (selector) => Array.from(document.querySelectorAll(selector));
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

const hero = select(".hero");
const shots = all(".reel-shot");
const reelControl = select("#slide-motion");
const shotCount = select(".count");
const failedShots = new Set();
let currentShot = 0;
let autoReel = !motion.matches;
let heroVisible = true;
let loadTimer;
let showingPhoto = false;

function prepareShot(index) {
  const video = shots[index];
  if (video.dataset.src) {
    video.preload = "metadata";
    video.src = video.dataset.src;
    delete video.dataset.src;
    video.load();
  }
  return video;
}
function mayPlayReel() {
  return !select("#main").hidden && autoReel && !showingPhoto && heroVisible &&
    !document.hidden && !document.querySelector("dialog[open]");
}
function updateReelControl() {
  const label = showingPhoto ? "Retry landscape reel" : (autoReel ? "Pause homepage reel" : "Play homepage reel");
  reelControl.setAttribute("aria-label", label);
  reelControl.querySelector("span").textContent = showingPhoto ? "↻" : (autoReel ? "Ⅱ" : "▶");
}
function showShot(index) {
  if (index !== currentShot || showingPhoto || (index > 0 && shots[index].readyState < 2)) return;
  hero.dataset.film = index === 0 ? "logo" : "landscape";
  shots.forEach((video, n) => video.classList.toggle("active", n === index));
  select("#slide-caption").textContent = shots[index].dataset.title;
  select("#slide-index").textContent = String(index + 1).padStart(2, "0");
  shotCount.hidden = false;
}
function showGardenPhoto() {
  window.clearTimeout(loadTimer);
  showingPhoto = true;
  hero.dataset.film = "landscape";
  shots.forEach(video => {
    video.pause();
    video.classList.remove("active");
  });
  select("#slide-caption").textContent = "Garden inspiration";
  shotCount.hidden = true;
  updateReelControl();
}
function selectShot(index) {
  window.clearTimeout(loadTimer);
  shots[currentShot].pause();
  showingPhoto = false;
  currentShot = index;
  const video = prepareShot(index);
  if (video.readyState >= 1) video.currentTime = Number(video.dataset.start || 0);
  showShot(index);
  updateReelControl();
  syncReel();
}
function stepShot(direction, landscapesOnly = false) {
  const first = landscapesOnly ? 1 : 0;
  const count = shots.length - first;
  let index = currentShot;
  for (let tries = 0; tries < count; tries++) {
    index = first + (index - first + direction + count) % count;
    if (!failedShots.has(index)) {
      selectShot(index);
      return;
    }
  }
  showGardenPhoto();
}
function shotFailed(index) {
  if (failedShots.has(index)) return;
  failedShots.add(index);
  if (index !== currentShot || showingPhoto) return;
  if (index === 0) {
    autoReel = false;
    syncReel();
    updateReelControl();
  } else {
    stepShot(1, true);
  }
}
function syncReel() {
  window.clearTimeout(loadTimer);
  const index = currentShot;
  const video = shots[index];
  if (!mayPlayReel()) {
    video.pause();
    return;
  }
  prepareShot(index);
  video.playbackRate = Number(video.dataset.rate);
  if (video.readyState < 3) loadTimer = window.setTimeout(() => shotFailed(index), 11000);
  video.play().catch(error => {
    if (index !== currentShot || error.name === "AbortError") return;
    if (error.name === "NotAllowedError") {
      window.clearTimeout(loadTimer);
      autoReel = false;
      updateReelControl();
    } else {
      shotFailed(index);
    }
  });
}
shots.forEach((video, index) => {
  video.defaultPlaybackRate = Number(video.dataset.rate);
  video.addEventListener("loadedmetadata", () => {
    video.currentTime = Number(video.dataset.start || 0);
    video.playbackRate = Number(video.dataset.rate);
  });
  video.addEventListener("loadeddata", () => showShot(index));
  video.addEventListener("playing", () => {
    if (index !== currentShot || !mayPlayReel()) { video.pause(); return; }
    window.clearTimeout(loadTimer);
    showShot(index);
    const next = index + 1 < shots.length ? index + 1 : 1;
    if (!failedShots.has(next)) prepareShot(next);
  });
  video.addEventListener("waiting", () => {
    if (index !== currentShot || !mayPlayReel()) return;
    window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => shotFailed(index), 11000);
  });
  video.addEventListener("timeupdate", () => {
    if (index === currentShot && mayPlayReel() && video.dataset.stop && video.currentTime >= Number(video.dataset.stop)) stepShot(1, true);
  });
  video.addEventListener("ended", () => {
    if (index === currentShot) stepShot(1, true);
  });
  video.addEventListener("error", () => shotFailed(index));
});
function retryShot(index) {
  if (failedShots.delete(index) && shots[index].error) shots[index].load();
}
function retryLandscapes() {
  for (let index = 1; index < shots.length; index++) retryShot(index);
  autoReel = true;
  selectShot(1);
}
reelControl.addEventListener("click", () => {
  if (showingPhoto) { retryLandscapes(); return; }
  autoReel = !autoReel;
  if (autoReel) retryShot(currentShot);
  updateReelControl();
  syncReel();
});
select(".slide-next").addEventListener("click", () => stepShot(1));
select(".slide-prev").addEventListener("click", () => stepShot(-1));
select("#open-film").addEventListener("click", () => {
  retryShot(0);
  autoReel = true;
  selectShot(0);
});
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    syncReel();
  }).observe(hero);
}
document.addEventListener("visibilitychange", syncReel);
window.addEventListener("online", () => { if (showingPhoto && !motion.matches) retryLandscapes(); });
motion.addEventListener("change", () => {
  if (motion.matches) autoReel = false;
  updateReelControl();
  syncReel();
});
all("dialog").forEach(dialog => {
  dialog.addEventListener("close", syncReel);
  dialog.addEventListener("toggle", syncReel);
});
all("dialog").forEach((dialog) => {
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
      dialog.close();
    }
  });
});

const projectDialog = select("#project-dialog");
const form = select("#project-form");
const status = select(".form-status");
function openBrief(direction) {
  toggleMenu(false);
  status.textContent = "";
  if (direction) form.elements.direction.value = direction;
  projectDialog.showModal();
  projectDialog.scrollTop = 0;
}
all(".start-project").forEach((button) => button.addEventListener("click", () => openBrief()));

function projectBrief() {
  const values = new FormData(form);
  return [
    "CENTURY LANDSCAPES", "Residential landscape project brief", "",
    "Name: " + values.get("name").trim(),
    "Project city: " + values.get("city").trim(),
    "Design direction: " + values.get("direction"), "",
    "Project goals", values.get("goals").trim()
  ].join("\n");
}
function validateBrief() {
  for (const name of ["name", "city", "goals"]) {
    const input = form.elements.namedItem(name);
    input.value = input.value.trim();
  }
  return form.reportValidity();
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateBrief()) return;
  const subject = "Landscape project inquiry — " + form.elements.city.value;
  const email = "mailto:artur@momentum-tennis.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(projectBrief());
  window.location.href = email;
  status.textContent = "Send the draft from your email app. If it did not open, download a copy and email it to artur@momentum-tennis.com.";
});
select("#save-brief").addEventListener("click", () => {
  if (!validateBrief()) return;
  const file = URL.createObjectURL(new Blob([projectBrief()], {type: "text/plain;charset=utf-8"}));
  const download = document.createElement("a");
  download.href = file;
  download.download = "Century-Landscapes-Project-Brief.txt";
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(file), 30000);
  status.textContent = "Your brief is ready to share. A copy has been prepared for download.";
});

let advancingTo = null;
let advanceTimer = 0;
function advanceAfter(section) {
  if (motion.matches || document.hidden || advancingTo || document.querySelector("dialog[open]")) return;
  const sequence = Array.from(section.closest("main").querySelectorAll("[data-auto-film]"))
    .filter(film => film.dataset.autoFilm === section.dataset.autoFilm);
  const index = sequence.indexOf(section);
  if (index < 0 || index + 1 >= sequence.length) return;
  advancingTo = sequence[index + 1];
  window.scrollTo({top:window.scrollY + advancingTo.getBoundingClientRect().top, behavior:"smooth"});
  window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(() => { advancingTo = null; }, 1400);
}

// Each garden owns its film position. Scroll, keyboard seeking, and timed playback
// share one timeline, including the last visible frame in either direction.
function setupScrollFilm(section) {
  const pin = section.querySelector("[data-pin]");
  const video = section.querySelector("[data-film-video]");
  const range = section.querySelector("[data-film-range]");
  const play = section.querySelector("[data-film-play]");
  const page = section.closest("main");
  if (video.dataset.copy) {
    const original = document.getElementById(video.dataset.copy);
    video.dataset.src = original.dataset.src || original.src;
    video.poster = original.poster;
  }
  const initialLabel = play.innerHTML;
  const max = Number(range.max);
  const frameRate = 24;
  const autoplay = section.hasAttribute("data-auto-film");
  let userPaused = false;
  let automaticRun = false;
  let autoTimer = 0;
  let previousPosition = null;
  let desired = 0;
  let playing = false;
  let resume = false;
  let visible = true;
  let failed = false;
  let queued = false;

  function load() {
    if (page.hidden || !video.dataset.src) return;
    video.src = video.dataset.src;
    delete video.dataset.src;
    video.load();
  }
  function updateRange(value) {
    desired = Math.max(0, Math.min(max, Math.round(value)));
    range.value = String(desired);
    range.setAttribute("aria-valuetext", Math.round(desired / max * 100) + "% complete");
  }
  function lastTime() {
    return Math.max(0, video.duration - 1 / frameRate);
  }
  function seek() {
    if (page.hidden || playing || video.seeking || !Number.isFinite(video.duration) || video.readyState < 1) return;
    const seconds = Math.round(desired / max * lastTime() * frameRate) / frameRate;
    if (Math.abs(video.currentTime - seconds) > 0.48 / frameRate) video.currentTime = seconds;
  }
  function pause() {
    window.clearTimeout(autoTimer);
    playing = false;
    resume = false;
    video.pause();
    play.innerHTML = initialLabel;
  }
  function inView() {
    const rect = pin.getBoundingClientRect();
    return rect.top <= window.innerHeight / 2 && rect.bottom > window.innerHeight / 2;
  }
  function setPlaybackRate() {
    if (Number.isFinite(video.duration) && video.duration > 0)
      video.playbackRate = automaticRun ? 1 : video.duration / 20;
  }
  function startPlayback(automatic = false) {
    automaticRun = automatic;
    setPlaybackRate();
    resume = false;
    playing = true;
    play.innerHTML = 'Pause <span aria-hidden="true">Ⅱ</span>';
    video.play().catch(error => {
      if (error.name === "AbortError" || !playing) return;
      userPaused = true;
      pause();
    });
  }
  function canAutoplay() {
    return (!advancingTo || advancingTo === section) && autoplay && !userPaused && !motion.matches && !document.hidden && !page.hidden &&
      !failed && !playing && desired < max && !document.querySelector("dialog[open]") && inView();
  }
  function checkAutoplay() {
    if (!autoplay) return;
    window.clearTimeout(autoTimer);
    if (playing && (page.hidden || document.hidden || !inView() || document.querySelector("dialog[open]"))) pause();
    if (canAutoplay()) autoTimer = window.setTimeout(() => {
      if (canAutoplay()) { load(); startPlayback(true); }
    }, 300);
  }
  function followScroll() {
    queued = false;
    if (motion.matches || page.hidden || !visible || failed) return;
    const distance = section.offsetHeight - pin.offsetHeight;
    if (distance <= 0) return;
    const position = Math.max(0, Math.min(max, Math.round(-section.getBoundingClientRect().top / distance * max)));
    if (position !== previousPosition) {
      if (playing || resume) pause();
      const next = autoplay && previousPosition !== null ? desired + position - previousPosition : position;
      previousPosition = position;
      updateRange(next);
      seek();
      if (autoplay && !userPaused && position === max && desired === max && inView()) advanceAfter(section);
    }
    checkAutoplay();
  }
  function schedule() {
    if (queued || motion.matches || page.hidden || !visible) return;
    queued = true;
    requestAnimationFrame(followScroll);
  }
  function setMode() {
    section.classList.toggle("ready", !motion.matches && !failed);
    if (motion.matches && playing) pause();
    schedule();
  }
  range.addEventListener("input", () => {
    userPaused = true;
    window.clearTimeout(autoTimer);
    load();
    if (playing || resume) pause();
    updateRange(Number(range.value));
    seek();
  });
  play.addEventListener("click", () => {
    load();
    if (playing) {
      userPaused = true;
      pause();
      resume = true;
      play.textContent = "Resume ▶";
      return;
    }
    userPaused = false;
    if ((!autoplay && !resume) || video.ended || desired === max) {
      video.currentTime = 0;
      updateRange(0);
    }
    startPlayback(resume && automaticRun);
  });
  video.addEventListener("loadedmetadata", () => {
    setPlaybackRate();
    if (playing && desired > 0) video.currentTime = desired / max * lastTime();
    else seek();
  });
  video.addEventListener("seeked", seek);
  video.addEventListener("timeupdate", () => {
    if (playing && lastTime() > 0) updateRange(video.currentTime / lastTime() * max);
  });
  video.addEventListener("ended", () => {
    const advance = autoplay && playing && inView() && !page.hidden;
    pause();
    updateRange(max);
    if (advance) advanceAfter(section);
  });
  video.addEventListener("error", () => {
    failed = true;
    pause();
    section.classList.remove("ready");
    play.textContent = "Film unavailable";
    range.disabled = play.disabled = true;
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !page.hidden) { load(); schedule(); }
      else if (playing) pause();
    }, {rootMargin:"200px 0px"}).observe(section);
  } else load();
  window.addEventListener("scroll", schedule, {passive:true});
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) pause();
    else checkAutoplay();
  });
  if (autoplay) all("dialog").forEach(dialog => {
    dialog.addEventListener("toggle", checkAutoplay);
    dialog.addEventListener("close", checkAutoplay);
  });
  motion.addEventListener("change", setMode);
  setMode();
  return {open() { visible = true; previousPosition = null; load(); updateRange(0); seek(); schedule(); }, pause};
}

const home = select("#main");
const mast = select(".mast");
const skip = select(".skip");
const backTop = select(".backtop");
const homeTitle = document.title;
const tourPages = all(".garden-tour");
const requestedTour = () => tourPages.find(page =>
  window.location.hash === "#" + page.id || window.location.hash === "#" + page.id + "-build");
home.hidden = Boolean(requestedTour());
const films = new Map(all("[data-scroll-film]").map(section =>
  [section, setupScrollFilm(section)]));
let activeTour = null;

function routeGarden() {
  const page = requestedTour();
  if (!page && !activeTour) return;
  const previous = activeTour;
  const changed = page !== previous;
  if (previous && changed) films.get(previous.querySelector("[data-scroll-film]")).pause();
  activeTour = page || null;
  home.hidden = mast.hidden = Boolean(page);
  tourPages.forEach(tour => { tour.hidden = tour !== page; });
  skip.setAttribute("href", page ? "#" + page.id + "-build" : "#main");
  skip.textContent = page ? "Skip to materials and build" : "Skip to content";
  backTop.setAttribute("href", page ? "#" + page.id : "#top");
  syncReel();
  if (page) {
    home.querySelectorAll("[data-scroll-film]").forEach(section => films.get(section).pause());
    const heading = page.querySelector("h1");
    document.title = heading.textContent + " | Century Landscapes";
    if (changed) {
      films.get(page.querySelector("[data-scroll-film]")).open();
    }
    if (window.location.hash.endsWith("-build")) {
      page.querySelector(".tour-notes").scrollIntoView({behavior:"instant"});
      page.querySelector(".tour-notes h2").focus({preventScroll:true});
    } else {
      window.scrollTo({top:0,behavior:"instant"});
      heading.focus({preventScroll:true});
    }
  } else {
    document.title = homeTitle;
    const hash = window.location.hash.slice(1);
    const target = document.getElementById(hash) || select("#gardens");
    if (target.id === "gardens") {
      const link = document.getElementById(previous.id + "-card");
      link.closest("[data-scroll-film]").scrollIntoView({behavior:"instant"});
      link.focus({preventScroll:true});
    } else target.scrollIntoView({behavior:"instant"});
  }
}

tourPages.forEach(page => {
  const brief = page.querySelector(".tour-brief");
  brief.addEventListener("click", () => openBrief(brief.dataset.direction));
});
window.addEventListener("hashchange", routeGarden);
routeGarden();
updateReelControl();
syncReel();
