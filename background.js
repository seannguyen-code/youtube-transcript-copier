chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async function() {
        async function sleep(ms) {
          return new Promise((r) => setTimeout(r, ms));
        }

        async function waitForSelector(selector, { timeout = 8000, interval = 200 } = {}) {
          const start = performance.now();
          while (performance.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(interval);
          }
          return null;
        }

        async function openTranscript() {
          // 1) Try the description block "Show transcript" button
          let btn = document.querySelector("ytd-video-description-transcript-section-renderer button[aria-label='Show transcript']");
          if (btn) {
            btn.click();
            // Give it a moment to mount the panel
            await sleep(1200);
          }

          // 2) If transcript still not visible, try the engagement panel chip:
          const panelHasSegments = !!document.querySelector("ytd-transcript-segment-renderer");
          if (!panelHasSegments) {
            const chip = document.querySelector("chip-bar-view-model button[aria-label='Transcript']");
            if (chip) {
              chip.click();
              await sleep(1200);
            }
          }
        }

        async function extractTranscriptText() {
          // We only want the text lines.
          const segments = document.querySelectorAll("ytd-transcript-segment-renderer .segment-text");
          if (!segments.length) return null;

          const lines = [];
          segments.forEach((node) => {
            const t = node.textContent.trim();
            if (t) lines.push(t);
          });
          return lines.join("\n");
        }

        async function copyTranscriptWithPrompt() {
          try {
            console.log("Transcript copier: go time.");

            // Optional: expand description if the page still hides it behind "More"
            const expandButton = document.querySelector("tp-yt-paper-button#expand");
            if (expandButton) {
              expandButton.click();
              await sleep(400);
            }

            await openTranscript();

            // Wait for first segment to appear
            const firstSegment = await waitForSelector("ytd-transcript-segment-renderer", { timeout: 8000 });
            if (!firstSegment) {
              alert("Transcript not found. Try reloading the page.");
              return;
            }

            const transcript = await extractTranscriptText();
            if (!transcript) {
              alert("Found transcript UI but no lines. YouTube UI probably glitching.");
              return;
            }

            const customPrompt = `Summarize the text below. Create sections for each important point with a brief summary:

`;
            const finalText = customPrompt + transcript;

            await navigator.clipboard.writeText(finalText);
            console.log("Transcript copied successfully.");
            alert("Transcript (no timestamps) + prompt copied to clipboard.");
          } catch (err) {
            console.error(err);
            alert("Failed to copy transcript.");
          }
        }

        // Kick off when the content script runs
        copyTranscriptWithPrompt();
      },
    });
  } catch (e) {
    console.error("Failed to inject content script", e);
  }
});
