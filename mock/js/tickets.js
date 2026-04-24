document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('price-tbody').innerHTML = PRICES.map(p => `
    <tr>
      <td>${p.cat}</td>
      <td><div class="ticket-price">${p.price}</div></td>
      <td><div class="ticket-note">${p.note || '—'}</div></td>
    </tr>
  `).join('');
});
