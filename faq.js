document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.classList.add('faq-enhanced');
      document.querySelectorAll(".faq-item").forEach((item) => {
        const question = item.querySelector(".faq-question");
        const icon = question?.querySelector("i");

        if (!question) return;

        question.addEventListener("click", () => {
          const isOpen = item.classList.toggle("open");
          question.setAttribute("aria-expanded", String(isOpen));

          if (icon) {
            icon.classList.toggle("fa-chevron-down", !isOpen);
            icon.classList.toggle("fa-chevron-up", isOpen);
          }
        });
      });

      const faqSearch = document.getElementById("faq-search");
      const faqFilters = Array.from(document.querySelectorAll(".faq-filter"));
      const faqItems = Array.from(document.querySelectorAll(".faq-list .faq-item"));
      const faqEmpty = document.getElementById("faq-empty");
      let activeFaqFilter = "all";

      const applyFaqFilters = () => {
        const searchTerm = (faqSearch?.value || "").trim().toLowerCase();
        let visibleCount = 0;

        faqItems.forEach((item) => {
          const categories = (item.dataset.faqCategory || "").toLowerCase().split(/\s+/).filter(Boolean);
          const searchableText = `${item.dataset.faqSearch || ""} ${item.textContent || ""}`.toLowerCase();
          const matchesFilter = activeFaqFilter === "all" || categories.includes(activeFaqFilter);
          const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
          const isVisible = matchesFilter && matchesSearch;

          item.hidden = !isVisible;
          if (isVisible) {
            visibleCount += 1;
          }
        });

        if (faqEmpty) {
          faqEmpty.hidden = visibleCount > 0;
        }
      };

      faqFilters.forEach((button) => {
        button.addEventListener("click", () => {
          activeFaqFilter = button.dataset.faqFilter || "all";
          faqFilters.forEach((filterButton) => {
            filterButton.classList.toggle("is-active", filterButton === button);
            filterButton.setAttribute('aria-pressed', String(filterButton === button));
          });
          applyFaqFilters();
        });
      });

      faqSearch?.addEventListener("input", applyFaqFilters);
      // Classify locally: never pass or persist the visitor's search text.
      const faqTopics = [
        ["bond", /\b(bond|deposit)\b/i],
        ["burn_time", /\b(burn(?:ing)?|duration|last(?:s)?)\b/i],
        ["returns", /\b(return(?:s|ing)?|clean(?:ing)?)\b/i],
        ["pickup", /\b(pick\s*up|collect(?:ion)?|delivery|transport)\b/i],
        ["pricing", /\b(pric(?:e|es|ing)|cost|fee(?:s)?|minimum|quantity|quantities)\b/i],
        ["safety", /\b(safe(?:ty)?|fire|flame|light(?:er|ing)?|damage)\b/i],
        ["availability", /\b(availab(?:le|ility)|book(?:ing)?|date)\b/i],
      ];
      let faqSearchTimer;
      let lastFaqTopic;
      const scheduleFaqTracking = (event) => {
        clearTimeout(faqSearchTimer);
        if (event.isComposing) return;
        if (!faqSearch.value.trim()) {
          lastFaqTopic = undefined;
          return;
        }
        faqSearchTimer = setTimeout(() => {
          const term = faqSearch.value.trim();
          if (!term) return;
          const topic = faqTopics.find(([, pattern]) => pattern.test(term))?.[0] || "other";
          if (topic === lastFaqTopic) return;
          if (window.trackLustreEvent?.("faq_search", { faq_topic: topic })) lastFaqTopic = topic;
        }, 700);
      };
      faqSearch?.addEventListener("input", scheduleFaqTracking);
      faqSearch?.addEventListener("compositionstart", () => clearTimeout(faqSearchTimer));
      faqSearch?.addEventListener("compositionend", scheduleFaqTracking);
      applyFaqFilters();

});
