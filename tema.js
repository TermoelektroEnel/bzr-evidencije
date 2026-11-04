// Svetli / tamni izgled. Učitava se u <head>, pre prikaza stranice, da ne bi
// "bljesnuo" svetli izgled. Podrazumevano je tamno; izbor se pamti u pregledaču.
(function () {
  var KLJUC = 'bzr-tema';
  var tema = 'tamna';
  try { tema = localStorage.getItem(KLJUC) || 'tamna'; } catch (e) {}
  document.documentElement.setAttribute('data-tema', tema);

  function osveziDugme() {
    var b = document.getElementById('tema-btn');
    if (!b) return;
    var tamna = document.documentElement.getAttribute('data-tema') === 'tamna';
    b.textContent = tamna ? '☀' : '🌙';
    b.title = tamna ? 'Pređi na svetli izgled' : 'Pređi na tamni izgled';
    b.setAttribute('aria-label', b.title);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('tema-btn');
    if (b) b.addEventListener('click', function () {
      var nova = document.documentElement.getAttribute('data-tema') === 'tamna' ? 'svetla' : 'tamna';
      document.documentElement.setAttribute('data-tema', nova);
      try { localStorage.setItem(KLJUC, nova); } catch (e) {}
      osveziDugme();
    });
    osveziDugme();
  });
})();
