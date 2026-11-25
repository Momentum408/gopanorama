(() => {
  const gallery = document.querySelector(".catalogue-gallery");
  if (typeof gallery?.showModal !== "function") return;

  const links = [...document.querySelectorAll(".project-stages a, .more-projects-grid .stage-frame, .review-photo-grid a")];
  const photos = links.map((link) => {
    const image = link.querySelector("img");
    const project = link.closest("article").querySelector("h2, h3").textContent;
    const stage = link.closest(".stage")?.querySelector("h3").textContent
      ?? link.closest(".review-photo-stage")?.getAttribute("aria-label")
      ?? (link.closest(".review-photos") ? "Reviewer photo" : "Finished work");
    return {
      src: image.src,
      description: image.alt,
      caption: `${project} · ${stage}`,
      filter: getComputedStyle(image).filter,
    };
  });
  const image = gallery.querySelector(".gallery-photo");
  const caption = gallery.querySelector(".gallery-caption");
  const count = gallery.querySelector(".gallery-count");
  const error = gallery.querySelector(".gallery-error");
  const closeButton = gallery.querySelector(".gallery-close");
  let current = 0;
  let opener;

  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    error.hidden = true;
    image.hidden = false;
    image.alt = photo.description;
    image.style.filter = photo.filter;
    image.src = photo.src;
    caption.textContent = photo.caption;
    count.textContent = `${current + 1} / ${photos.length}`;
  }

  links.forEach((link, index) => {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      showPhoto(index);
      gallery.showModal();
    });
  });

  image.addEventListener("error", () => {
    image.hidden = true;
    error.hidden = false;
  });
  closeButton.addEventListener("click", () => gallery.close());
  gallery.querySelector(".gallery-prev").addEventListener("click", () => showPhoto(current - 1));
  gallery.querySelector(".gallery-next").addEventListener("click", () => showPhoto(current + 1));
  gallery.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(current + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  gallery.addEventListener("click", (event) => {
    if (event.target === gallery) gallery.close();
  });
  gallery.addEventListener("close", () => opener?.focus({ preventScroll: true }));
})();
