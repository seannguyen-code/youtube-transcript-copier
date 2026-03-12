chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async function () {
        function sleep(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }

        async function waitFor(conditionFn, { timeout = 10000, interval = 250 } = {}) {
          const start = performance.now();
          let lastError = null;

          while (performance.now() - start < timeout) {
            try {
              const result = await conditionFn();
              if (result) return result;
            } catch (err) {
              lastError = err;
            }
            await sleep(interval);
          }

          if (lastError) console.warn("waitFor last error:", lastError);
          return null;
        }

        function normalizeText(text) {
          return (text || "")
            .replace(/\u00A0/g, " ")
            .replace(/\s*\n\s*/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }

        function clickElement(el) {
          if (!el) return false;
          try {
            el.scrollIntoView({ block: "center", inline: "center" });
          } catch {}
          try {
            el.click();
            return true;
          } catch {}
          try {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            return true;
          } catch {}
          return false;
        }

        function getAllTranscriptPanels() {
          return [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")];
        }

        function isExpandedPanel(panel) {
          const visibility = panel.getAttribute("visibility") || "";
          return visibility.includes("EXPANDED") || !visibility;
        }

        function scoreTranscriptPanel(panel) {
          let score = 0;

          if (!panel) return -1;

          if (panel.matches("[target-id='engagement-panel-searchable-transcript']")) score += 100;
          if (isExpandedPanel(panel)) score += 20;

          const titleText = normalizeText(panel.querySelector("#title-text")?.textContent);
          if (titleText === "In this video") score += 30;

          if (panel.querySelector("button[role='tab'][aria-label='Transcript']")) score += 20;
          if (panel.querySelector("ytd-transcript-renderer")) score += 50;
          if (panel.querySelector("ytd-transcript-segment-renderer .segment-text")) score += 100;
          if (panel.querySelector("transcript-segment-view-model span[role='text']")) score += 100;

          return score;
        }

        function getTranscriptPanel() {
          const panels = getAllTranscriptPanels();
          if (!panels.length) return null;

          return panels.map((panel) => ({ panel, score: scoreTranscriptPanel(panel) })).sort((a, b) => b.score - a.score)[0]?.panel || null;
        }

        function hasTranscriptContent(panel = getTranscriptPanel()) {
          if (!panel) return false;

          return !!(panel.querySelector("ytd-transcript-segment-renderer .segment-text") || panel.querySelector("transcript-segment-view-model span[role='text']"));
        }

        async function expandDescriptionIfNeeded() {
          const candidates = ["tp-yt-paper-button#expand", "button[aria-label='Show more']", "#description-inline-expander tp-yt-paper-button", "#expand"];

          for (const selector of candidates) {
            const btn = document.querySelector(selector);
            if (btn && clickElement(btn)) {
              await sleep(500);
              return true;
            }
          }

          return false;
        }

        function findShowTranscriptButton() {
          const directSelectors = ["button[aria-label='Show transcript']", "ytd-video-description-transcript-section-renderer button", "tp-yt-paper-button[aria-label='Show transcript']"];

          for (const selector of directSelectors) {
            const el = document.querySelector(selector);
            if (el) return el;
          }

          const textMatch = [...document.querySelectorAll("button, tp-yt-paper-button")].find((btn) => normalizeText(btn.textContent).toLowerCase().includes("show transcript"));

          return textMatch || null;
        }

        function findTranscriptTab(panel = getTranscriptPanel()) {
          const scoped = panel
            ? [
                panel.querySelector("chip-bar-view-model button[aria-label='Transcript']"),
                panel.querySelector("button[role='tab'][aria-label='Transcript']"),
                [...panel.querySelectorAll("button[role='tab'], button")].find((btn) => btn.getAttribute("aria-label") === "Transcript" || normalizeText(btn.textContent) === "Transcript"),
              ].find(Boolean)
            : null;

          if (scoped) return scoped;

          return (
            document.querySelector("chip-bar-view-model button[aria-label='Transcript']") ||
            document.querySelector("button[role='tab'][aria-label='Transcript']") ||
            [...document.querySelectorAll("button[role='tab'], button")].find((btn) => btn.getAttribute("aria-label") === "Transcript" || normalizeText(btn.textContent) === "Transcript") ||
            null
          );
        }

        async function openTranscript() {
          if (hasTranscriptContent()) return true;

          const showTranscriptBtn = findShowTranscriptButton();
          if (showTranscriptBtn) {
            clickElement(showTranscriptBtn);
            await sleep(1500);
            if (hasTranscriptContent()) return true;
          }

          const transcriptTab = findTranscriptTab();
          if (transcriptTab) {
            clickElement(transcriptTab);
            await sleep(1500);
            if (hasTranscriptContent()) return true;
          }

          const matchingPanel = getAllTranscriptPanels().find((panel) => {
            const titleText = normalizeText(panel.querySelector("#title-text")?.textContent);
            return panel.getAttribute("target-id") === "engagement-panel-searchable-transcript" || titleText === "In this video" || normalizeText(panel.textContent).includes("Transcript");
          });

          if (matchingPanel) {
            const transcriptChip = matchingPanel.querySelector("button[role='tab'][aria-label='Transcript']") || matchingPanel.querySelector("chip-bar-view-model button[aria-label='Transcript']");

            if (transcriptChip) {
              clickElement(transcriptChip);
              await sleep(1200);
              if (hasTranscriptContent(matchingPanel)) return true;
            }
          }

          return hasTranscriptContent();
        }

        function extractOldTranscriptText(panel) {
          const sections = panel.querySelectorAll("ytd-macro-markers-list-renderer ytd-item-section-renderer");

          if (!sections.length) {
            const segments = panel.querySelectorAll("transcript-segment-view-model span[role='text']");

            if (!segments.length) return null;

            return [...segments]
              .map((node) => normalizeText(node.textContent))
              .filter(Boolean)
              .join("\n");
          }

          const output = [];

          for (const section of sections) {
            const chapterTitle = section.querySelector(".ytwTimelineChapterViewModelTitle");
            const titleText = normalizeText(chapterTitle?.textContent);

            if (titleText) {
              if (output.length) output.push("");
              output.push(titleText);
            }

            const segmentTexts = section.querySelectorAll("transcript-segment-view-model span[role='text']");

            for (const node of segmentTexts) {
              const text = normalizeText(node.textContent);
              if (text) output.push(text);
            }
          }

          return output.length ? output.join("\n") : null;
        }

        function extractNewTranscriptText(panel) {
          const list = panel.querySelector("ytd-transcript-segment-list-renderer");
          if (!list) return null;

          const container = list.querySelector("#segments-container");
          if (!container) return null;

          const output = [];
          const children = [...container.children];

          for (const node of children) {
            if (node.matches("ytd-transcript-section-header-renderer")) {
              const title = node.querySelector(".transcript-section-header [role='text']")?.textContent || node.querySelector(".transcript-section-header")?.getAttribute("aria-label") || "";

              const cleanTitle = normalizeText(title);
              if (cleanTitle) {
                if (output.length) output.push("");
                output.push(cleanTitle);
              }
              continue;
            }

            if (node.matches("ytd-transcript-segment-renderer")) {
              const textNode = node.querySelector(".segment-text");
              const text = normalizeText(textNode?.textContent);
              if (text) output.push(text);
            }
          }

          return output.length ? output.join("\n") : null;
        }

        function extractTranscriptText() {
          const panel = getTranscriptPanel();
          if (!panel) return null;

          const newText = extractNewTranscriptText(panel);
          if (newText) return newText;

          const oldText = extractOldTranscriptText(panel);
          if (oldText) return oldText;

          return null;
        }

        async function copyTranscriptWithPrompt() {
          try {
            console.log("Transcript copier: starting");

            await expandDescriptionIfNeeded();
            await openTranscript();

            const firstSegment = await waitFor(
              () => {
                const panel = getTranscriptPanel();
                if (!panel) return null;

                return panel.querySelector("ytd-transcript-segment-renderer .segment-text") || panel.querySelector("transcript-segment-view-model span[role='text']");
              },
              { timeout: 12000, interval: 250 },
            );

            if (!firstSegment) {
              alert("Transcript not found. YouTube changed its UI again, because apparently consistency is illegal.");
              return;
            }

            const transcript = extractTranscriptText();

            if (!transcript) {
              alert("Transcript panel opened, but no transcript text was extracted.");
              return;
            }

            const customPrompt = "Summarize the text below. Create sections for each important point with a brief summary:\n\n";

            const finalText = customPrompt + transcript;

            await navigator.clipboard.writeText(finalText);

            console.log("Transcript copied successfully");
            alert("Transcript + prompt copied to clipboard.");
          } catch (err) {
            console.error("Transcript copy failed:", err);
            alert("Failed to copy transcript.");
          }
        }

        copyTranscriptWithPrompt();
      },
    });
  } catch (e) {
    console.error("Failed to inject content script", e);
  }
});
