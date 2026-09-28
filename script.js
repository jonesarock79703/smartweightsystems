/* ==========================================================================
   SmartWeight Systems - Corporate Client JavaScript
   Automated Inventory Intelligence
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // 1. MOBILE HAMBURGER MENU
  // ==========================================
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const navLinksMenu = document.getElementById("navLinksMenu");

  if (hamburgerBtn && navLinksMenu) {
    hamburgerBtn.addEventListener("click", () => {
      const isOpen = navLinksMenu.classList.toggle("is-open");
      hamburgerBtn.classList.toggle("is-active", isOpen);
      hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu when clicking any navigation link
    navLinksMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navLinksMenu.classList.remove("is-open");
        hamburgerBtn.classList.remove("is-active");
        hamburgerBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ==========================================
  // 2. ACTIVE NAVIGATION HIGHLIGHT ON SCROLL
  // ==========================================
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  function highlightNavigation() {
    const scrollY = window.pageYOffset;

    sections.forEach((current) => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute("id");

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach((link) => {
          link.classList.remove("active");
          if (link.getAttribute("href") === `#${sectionId}`) {
            link.classList.add("active");
          }
        });
      }
    });
  }

  window.addEventListener("scroll", highlightNavigation, { passive: true });

  // ==========================================
  // 3. SOLUTION CAROUSEL SLIDER (OLD CAROUSEL COMPATIBLE)
  // ==========================================
  let currentSlideIndex = 0;
  let autoSlideTimer = null;

  function showSlide(index) {
    const slides = document.querySelectorAll(".carousel .slide, .carousel-slide");
    const dots = document.querySelectorAll(".dots .dot, .carousel-dot");
    if (!slides || slides.length === 0) return;

    if (index >= slides.length) {
      currentSlideIndex = 0;
    } else if (index < 0) {
      currentSlideIndex = slides.length - 1;
    } else {
      currentSlideIndex = index;
    }

    slides.forEach((slide, idx) => {
      slide.classList.toggle("active", idx === currentSlideIndex);
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentSlideIndex);
    });
  }

  function changeSlide(step) {
    showSlide(currentSlideIndex + step);
    resetAutoSlide();
  }

  function goSlide(index) {
    showSlide(index);
    resetAutoSlide();
  }

  // Expose functions globally for inline onclick handlers
  window.changeSlide = changeSlide;
  window.goSlide = goSlide;

  function startAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(() => {
      changeSlide(1);
    }, 1300);
  }

  function resetAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    startAutoSlide();
  }

  startAutoSlide();

  // Pause carousel on hover
  const carouselWraps = document.querySelectorAll(".carousel-wrap, .carousel-container");
  carouselWraps.forEach((wrap) => {
    wrap.addEventListener("mouseenter", () => {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
    });
    wrap.addEventListener("mouseleave", () => {
      startAutoSlide();
    });
  });

  // ==========================================
  // 4. DEMO FORM TOGGLE TRIGGER
  // ==========================================
  const demoToggleBtn = document.getElementById("demoToggleBtn");
  const ctaDemoBtn = document.getElementById("ctaDemoBtn");
  const demoPanel = document.getElementById("demoPanel");

  function openDemoPanel() {
    if (demoPanel) {
      demoPanel.classList.add("is-visible");
      demoPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstInput = demoPanel.querySelector("input");
      if (firstInput) firstInput.focus();
    }
  }

  if (demoToggleBtn) {
    demoToggleBtn.addEventListener("click", openDemoPanel);
  }

  if (ctaDemoBtn) {
    ctaDemoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openDemoPanel();
    });
  }

  // ==========================================
  // 5. TOAST NOTIFICATION UTILITY
  // ==========================================
  function showToast(message, isSuccess = true) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    if (!isSuccess) {
      toast.style.borderLeftColor = "#e53e3e";
    }

    toast.innerHTML = `
      <div class="toast-icon" style="color: ${isSuccess ? 'var(--green)' : '#e53e3e'};">
        ${isSuccess 
          ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
          : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
        }
      </div>
      <div class="toast-content">${message}</div>
      <button type="button" class="toast-close" aria-label="Close alert">&times;</button>
    `;

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Trigger transition
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  // ==========================================
  // 6. FORM SUBMISSIONS VIA BACKEND REST API
  // ==========================================

  // A. Demo Request Form
  const demoForm = document.getElementById("demoForm");
  if (demoForm) {
    demoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = demoForm.querySelector("button[type='submit']");
      const originalText = submitBtn ? submitBtn.innerHTML : "Submit Request";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting Request...";
      }

      const formData = new FormData(demoForm);
      const payload = {
        name: (formData.get("name") || "").trim(),
        email: (formData.get("email") || "").trim(),
        phone: (formData.get("phone") || "").trim(),
        companyName: (formData.get("company") || formData.get("companyName") || "").trim(),
        message: (formData.get("message") || "").trim(),
      };

      if (!payload.name || !payload.email || !payload.phone) {
        showToast("Please fill in all required fields (Name, Email, Phone)", false);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        return;
      }

      try {
        const res = await fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          showToast(data.message || "Thank you! Your demo request has been submitted.");
          demoForm.reset();
        } else {
          showToast(data.error || "Failed to submit demo request. Please check inputs.", false);
        }
      } catch (err) {
        console.error("Demo submission error:", err);
        showToast("Server connection error. Please ensure the backend is running.", false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // B. Contact Message Form
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector("button[type='submit']");
      const originalText = submitBtn ? submitBtn.innerHTML : "Send Message";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending Message...";
      }

      const formData = new FormData(contactForm);
      const payload = {
        name: (formData.get("name") || "").trim(),
        email: (formData.get("email") || "").trim(),
        phone: (formData.get("phone") || "").trim(),
        message: (formData.get("message") || "").trim(),
      };

      if (!payload.name || !payload.email || !payload.message) {
        showToast("Please fill in your name, email, and message", false);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        return;
      }

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          showToast(data.message || "Thank you! Your message has been sent.");
          contactForm.reset();
        } else {
          showToast(data.error || "Failed to send message. Please check required fields.", false);
        }
      } catch (err) {
        console.error("Contact submission error:", err);
        showToast("Server connection error. Please ensure the backend is running.", false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // ==========================================
  // 7. INTERACTIVE HARDWARE SCALE SIMULATOR
  // ==========================================
  const weightSlider = document.getElementById("weightSimSlider");
  const simWeightDisplay = document.getElementById("simWeightDisplay");
  const simCountDisplay = document.getElementById("simCountDisplay");
  const simSliderVal = document.getElementById("simSliderVal");
  const simAlertBanner = document.getElementById("simAlertBanner");
  const simAlertText = document.getElementById("simAlertText");
  const simStatusBadge = document.getElementById("simStatusBadge");
  const presetBtns = document.querySelectorAll(".sim-preset-btn");

  if (weightSlider && simWeightDisplay && simCountDisplay && simSliderVal) {
    const UNIT_WEIGHT_KG = 0.049; // ~49g per industrial fastener unit

    function updateScaleTelemetry(weight) {
      const units = Math.max(0, Math.round(weight / UNIT_WEIGHT_KG));

      // Update telemetry readouts
      weightSlider.value = weight;
      simSliderVal.textContent = weight.toFixed(1) + " kg";
      simWeightDisplay.innerHTML = `${weight.toFixed(2)} <small>kg</small>`;
      simCountDisplay.innerHTML = `${units} <small>units</small>`;

      // Threshold trigger at 10.0 kg
      if (weight <= 10.0) {
        if (simAlertBanner) {
          simAlertBanner.classList.add("triggered");
          if (simAlertText) {
            simAlertText.innerHTML = `⚠️ <strong>LOW STOCK THRESHOLD!</strong> Auto-PO #PO-9482 dispatched to Vendor (500 units).`;
          }
        }
        if (simStatusBadge) {
          simStatusBadge.textContent = "DISPATCHING PO";
          simStatusBadge.style.color = "#f87171";
          simStatusBadge.style.borderColor = "rgba(248, 113, 113, 0.4)";
          simStatusBadge.style.background = "rgba(239, 68, 68, 0.2)";
        }
      } else {
        if (simAlertBanner) {
          simAlertBanner.classList.remove("triggered");
          if (simAlertText) {
            simAlertText.innerHTML = `⚖️ Bin Level Optimal (${units} units). Continuous sub-gram load cells active.`;
          }
        }
        if (simStatusBadge) {
          simStatusBadge.textContent = "ONLINE";
          simStatusBadge.style.color = "#34d399";
          simStatusBadge.style.borderColor = "rgba(52, 211, 153, 0.3)";
          simStatusBadge.style.background = "rgba(16, 185, 129, 0.15)";
        }
      }
    }

    weightSlider.addEventListener("input", (e) => {
      updateScaleTelemetry(parseFloat(e.target.value));
    });

    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetWeight = parseFloat(btn.getAttribute("data-weight"));
        if (!isNaN(targetWeight)) {
          updateScaleTelemetry(targetWeight);
        }
      });
    });
  }

  // ==========================================
  // 8. INTERACTIVE ROI & EFFICIENCY CALCULATOR
  // ==========================================
  const roiBinsSlider = document.getElementById("roiBinsSlider");
  const roiHoursSlider = document.getElementById("roiHoursSlider");
  const roiRateSlider = document.getElementById("roiRateSlider");
  const roiBinsBubble = document.getElementById("roiBinsBubble");
  const roiHoursBubble = document.getElementById("roiHoursBubble");
  const roiRateBubble = document.getElementById("roiRateBubble");
  const roiLaborSavedVal = document.getElementById("roiLaborSavedVal");
  const roiHoursSavedVal = document.getElementById("roiHoursSavedVal");
  const roiPaybackVal = document.getElementById("roiPaybackVal");

  function calculateROI() {
    if (!roiBinsSlider || !roiHoursSlider || !roiRateSlider) return;

    const bins = parseInt(roiBinsSlider.value, 10);
    const weeklyHours = parseFloat(roiHoursSlider.value);
    const hourlyRate = parseFloat(roiRateSlider.value);

    // Update bubbles
    if (roiBinsBubble) roiBinsBubble.textContent = `${bins} Bins`;
    if (roiHoursBubble) roiHoursBubble.textContent = `${weeklyHours} hrs / wk`;
    if (roiRateBubble) roiRateBubble.textContent = `$${hourlyRate} / hr`;

    // Annual Calculations
    const annualHoursSaved = Math.round(weeklyHours * 52);
    const annualLaborSavings = Math.round(annualHoursSaved * hourlyRate);

    // Estimated Payback Period in months
    // Approx hardware installation cost = $110 per smart scale bin
    const estimatedHardwareCapex = bins * 110;
    const monthlySavings = Math.max(1, annualLaborSavings / 12);
    const paybackMonths = Math.max(1.2, Math.min(12, (estimatedHardwareCapex / monthlySavings))).toFixed(1);

    if (roiLaborSavedVal) {
      roiLaborSavedVal.textContent = `$${annualLaborSavings.toLocaleString()}`;
    }
    if (roiHoursSavedVal) {
      roiHoursSavedVal.innerHTML = `${annualHoursSaved.toLocaleString()} <small>hrs</small>`;
    }
    if (roiPaybackVal) {
      roiPaybackVal.innerHTML = `${paybackMonths} <small>mo</small>`;
    }
  }

  if (roiBinsSlider && roiHoursSlider && roiRateSlider) {
    roiBinsSlider.addEventListener("input", calculateROI);
    roiHoursSlider.addEventListener("input", calculateROI);
    roiRateSlider.addEventListener("input", calculateROI);
    calculateROI();
  }

});