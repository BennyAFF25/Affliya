(function initPartnerEstimator() {
  if (typeof window === 'undefined') return;

  const MAX_ATTEMPTS = 10;
  const RETRY_MS = 150;

  function q(id) {
    return document.getElementById(id);
  }

  function fmt(n) {
    try {
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 2,
      }).format(n);
    } catch (e) {
      return '$' + (Math.round(n * 100) / 100).toFixed(2);
    }
  }

  function recalc() {
    const priceInput = q('pp_price');
    const commInput = q('pp_comm');
    const salesInput = q('pp_sales');
    const typeSelect = q('pp_type');

    if (!priceInput || !commInput || !salesInput || !typeSelect) return;

    const price = parseFloat(priceInput.value || '0');
    const comm = parseFloat(commInput.value || '0');
    const sales = parseFloat(salesInput.value || '0');
    const type = typeSelect.value || 'one-time';

    const perSale = price * (comm / 100);
    const monthly = perSale * sales;
    const yearly = monthly * 12;

    const priceOut = q('pp_price_out');
    const commOut = q('pp_comm_out');
    const salesOut = q('pp_sales_out');
    const earnOut = q('pp_earn');
    const monthOut = q('pp_month_out');
    const yearOut = q('pp_year_out');
    const typeHelp = q('pp_type_help');
    const noteEl = q('pp_note');

    if (priceOut) priceOut.textContent = fmt(price);
    if (commOut) commOut.textContent = `${comm}%`;
    if (salesOut) salesOut.textContent = String(sales);
    if (earnOut) earnOut.textContent = fmt(perSale);
    if (monthOut) monthOut.textContent = fmt(monthly);
    if (yearOut) yearOut.textContent = fmt(yearly);

    if (typeHelp && noteEl) {
      if (type === 'recurring') {
        typeHelp.textContent = 'Each sale pays a recurring commission on the subscription price.';
        noteEl.textContent =
          'Yearly estimate assumes 12 billing cycles per subscriber at this commission and a steady flow of new subs.';
      } else {
        typeHelp.textContent = 'Each sale pays a one-time commission on the product price.';
        noteEl.textContent =
          'Yearly estimate assumes a consistent number of new sales each month at this commission.';
      }
    }
  }

  function bind(attempt) {
    const priceInput = q('pp_price');
    const commInput = q('pp_comm');
    const salesInput = q('pp_sales');
    const typeSelect = q('pp_type');

    // If elements aren't in the DOM yet (e.g. client navigation), retry briefly.
    if (!priceInput || !commInput || !salesInput || !typeSelect) {
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => bind(attempt + 1), RETRY_MS);
      }
      return;
    }

    priceInput.addEventListener('input', recalc, { passive: true });
    commInput.addEventListener('input', recalc, { passive: true });
    salesInput.addEventListener('input', recalc, { passive: true });
    typeSelect.addEventListener('change', recalc);

    // Initial paint
    recalc();
  }

  bind(0);
})();