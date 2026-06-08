function updateThemeButton(isDark) {
	const themeBtn = document.getElementById("theme-btn");
	if (themeBtn) {
		// Ändert nur das Icon-Emoji im Button, ohne das HTML zu zerstören
		themeBtn.innerText = isDark ? "☀️" : "🌙";
		themeBtn.title = isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln";
	}
}

function toggleDarkMode() {
	const isDark = document.documentElement.classList.toggle("dark");
	localStorage.setItem("darkMode", isDark);
	updateThemeButton(isDark);
}

// Beim Laden der Seite den gespeicherten Modus anwenden und Button-Icon setzen
const savedDarkMode =
	localStorage.getItem("darkMode") === "true" ||
	(!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);

if (savedDarkMode) {
	document.documentElement.classList.add("dark");
} else {
	document.documentElement.classList.remove("dark");
}

// Nach dem Laden das korrekte Icon anzeigen
document.addEventListener("DOMContentLoaded", () => {
	const isCurrentlyDark = document.documentElement.classList.contains("dark");
	updateThemeButton(isCurrentlyDark);
});

function toggleContrast() {
	const isContrast = document.documentElement.classList.toggle("contrast");
	localStorage.setItem("contrastMode", isContrast);

	// Ändert das Auge-Icon, um den Zustand anzuzeigen
	const contrastBtn = document.getElementById("contrast-btn");
	if (contrastBtn) {
		contrastBtn.innerText = isContrast ? "🕶️" : "👁️";
		contrastBtn.title = isContrast ? "Zu normalem Modus wechseln" : "Zu Kontrastmodus wechseln";
	}
}

// Beim Laden der Seite prüfen, ob Kontrastmodus aktiv ist
if (localStorage.getItem("contrastMode") === "true") {
	document.documentElement.classList.add("contrast");
	document.addEventListener("DOMContentLoaded", () => {
		const contrastBtn = document.getElementById("contrast-btn");
		if (contrastBtn) contrastBtn.innerText = "🕶️";
	});
}
