// Shared site navigation. Rendered into a target element with the current
// page highlighted. Single source of truth for nav links.

const LINKS = [
  { href: "/", label: "Home", key: "home" },
  { href: "/platform/console.html", label: "Console", key: "console" },
  { href: "/blog/", label: "Blog", key: "blog" },
  { href: "/about.html", label: "About", key: "about" },
];

export function renderSiteNav(container, currentKey = null) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.add("site-nav");

  const toggle = document.createElement("button");
  toggle.className = "site-nav-toggle";
  toggle.setAttribute("aria-label", "Toggle navigation");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = "<span></span><span></span><span></span>";

  const ul = document.createElement("ul");
  ul.className = "site-nav-links";
  for (const link of LINKS) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = link.label;
    if (link.key === currentKey) a.classList.add("active");
    li.appendChild(a);
    ul.appendChild(li);
  }

  container.appendChild(toggle);
  container.appendChild(ul);

  toggle.addEventListener("click", () => {
    const open = container.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  ul.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      container.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}
