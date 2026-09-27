// Background music. Never autoplays: browsers block it anyway, and a tool that
// starts making noise on load is annoying. One click starts it.
const AudioToggle = {
  audio: null,
  playing: false,

  init() {
    const button = document.getElementById("audioBtn");
    const status = document.getElementById("statusText");
    if (!button || !status) return;

    const playIcon = button.querySelector(".play-icon");
    const pauseIcon = button.querySelector(".pause-icon");

    this.audio = new Audio("the-return-of-the-8-bit-era-301292.mp3");
    this.audio.loop = true;
    this.audio.volume = 0.25;

    this.render = (playing) => {
      this.playing = playing;
      playIcon.style.display = playing ? "none" : "block";
      pauseIcon.style.display = playing ? "block" : "none";
      button.setAttribute("aria-label", playing ? "Pause music" : "Play music");
      status.textContent = playing ? "Now Playing" : "Music Off";
    };

    button.addEventListener("click", async () => {
      if (this.playing) {
        this.audio.pause();
        this.render(false);
        return;
      }
      try {
        await this.audio.play();
        this.render(true);
      } catch (error) {
        console.log("Playback was blocked:", error);
        this.render(false);
      }
    });

    this.audio.addEventListener("ended", () => this.render(false));
    this.render(false);
  },
};

document.addEventListener("DOMContentLoaded", () => AudioToggle.init());
