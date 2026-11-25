const menuButton = document.querySelector("#menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");
function toggleMenu(open) {
  mobileNav.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuButton.addEventListener("click", () => toggleMenu(mobileNav.hidden));
mobileNav.addEventListener("click", () => toggleMenu(false));
window.matchMedia("(min-width: 821px)").addEventListener("change", () => toggleMenu(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    toggleMenu(false);
    menuButton.focus();
  }
});
