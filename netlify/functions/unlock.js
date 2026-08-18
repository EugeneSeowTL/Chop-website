// unlock.js
// Shared across all CHOP. pages. Tracks which pricing tiers a visitor has
// unlocked (stored in localStorage after a verified Stripe payment) and
// applies/removes the "locked" overlay UI for any premium block on the page
// that declares data-tier="1|2|3|4".
//
// Usage on a tool page: give each premium block's outer wrapper (the div
// containing .locked-overlay) an attribute data-tier="2" (etc). This script
// finds every such block on load and unlocks it if that tier is paid for.

(function () {
  const STORAGE_KEY = 'chop_unlocked_tiers';

  function getUnlockedTiers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveUnlockedTiers(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      // localStorage unavailable — unlock will just be session-only via the in-memory set
    }
  }

  function markTierUnlocked(tier) {
    const tiers = getUnlockedTiers();
    tiers.add(String(tier));
    saveUnlockedTiers(tiers);
  }

  function isTierUnlocked(tier) {
    return getUnlockedTiers().has(String(tier));
  }

  // Remove the lock overlay + blur/disable from a premium block, leaving the
  // real tool underneath fully usable.
  function unlockBlock(block) {
    const overlay = block.querySelector('.locked-overlay');
    if (overlay) overlay.remove();

    block.querySelectorAll('.locked-fields').forEach((lf) => {
      // Drop the class that applies blur/opacity/pointer-events:none
      lf.classList.remove('locked-fields');
    });

    // Re-enable any disabled inputs/buttons/textareas/selects inside this block
    block.querySelectorAll('input, textarea, select, button').forEach((el) => {
      el.disabled = false;
    });

    // Swap the premium badge to show it's active for this visitor
    const badge = block.querySelector('.premium-badge');
    if (badge) badge.textContent = '✓ Unlocked';
  }

  function applyUnlocksOnPage() {
    document.querySelectorAll('[data-tier]').forEach((block) => {
      const tier = block.getAttribute('data-tier');
      if (tier && isTierUnlocked(tier)) {
        unlockBlock(block);
      }
    });
  }

  window.CHOP_UNLOCK = {
    isTierUnlocked,
    markTierUnlocked,
    applyUnlocksOnPage,
  };

  document.addEventListener('DOMContentLoaded', applyUnlocksOnPage);
})();
