(function(){
  function fmt(n){
    try {
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 2,
      }).format(n);
    } catch(e){
      return '$' + (Math.round(n*100)/100).toFixed(2);
    }
  }

  function calc(){
    var price = parseFloat(document.getElementById('pp_price')?.value || '0');
    var comm  = parseFloat(document.getElementById('pp_comm')?.value || '0');
    var sales = parseFloat(document.getElementById('pp_sales')?.value || '0');
    var typeEl = document.getElementById('pp_type');
    var type  = typeEl && typeEl.value ? typeEl.value : 'one-time';

    var perSale = price * (comm / 100);
    var monthly = perSale * sales;
    var yearly  = monthly * 12;

    var priceOut = document.getElementById('pp_price_out');
    var commOut  = document.getElementById('pp_comm_out');
    var salesOut = document.getElementById('pp_sales_out');
    var earnOut  = document.getElementById('pp_earn');
    var monthOut = document.getElementById('pp_month_out');
    var yearOut  = document.getElementById('pp_year_out');
    var typeHelp = document.getElementById('pp_type_help');
    var noteEl   = document.getElementById('pp_note');

    if(priceOut) priceOut.textContent = fmt(price);
    if(commOut)  commOut.textContent  = comm + '%';
    if(salesOut) salesOut.textContent = String(sales);
    if(earnOut)  earnOut.textContent  = fmt(perSale);
    if(monthOut) monthOut.textContent = fmt(monthly);
    if(yearOut)  yearOut.textContent  = fmt(yearly);

    if(typeHelp && noteEl){
      if(type === 'recurring'){
        typeHelp.textContent = 'Each sale pays a recurring commission on the subscription price.';
        noteEl.textContent   = 'Yearly estimate assumes 12 billing cycles per subscriber at this commission.';
      } else {
        typeHelp.textContent = 'Each sale pays a one-time commission on the product price.';
        noteEl.textContent   = 'Yearly estimate assumes a consistent number of new sales each month at this commission.';
      }
    }
  }

  function bind(){
    var p = document.getElementById('pp_price');
    var c = document.getElementById('pp_comm');
    var s = document.getElementById('pp_sales');
    var t = document.getElementById('pp_type');
    if(!p || !c || !s || !t) return;

    p.addEventListener('input', calc);
    c.addEventListener('input', calc);
    s.addEventListener('input', calc);
    t.addEventListener('change', calc);

    calc();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();