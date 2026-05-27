import { h, icon, errorBox } from '../components/ui.js';
import { unlockWithPassword, getMeta } from '../lib/auth.js';
import { loadEncryptedData } from '../lib/storage.js';
import { setSession } from '../lib/state.js';
import { navigate } from '../lib/router.js';

export async function renderUnlock() {
  const wrap = h('div', { class: 'auth-wrap' });
  const card = h('div', { class: 'auth-card glow-card' });
  wrap.appendChild(card);

  const meta = getMeta() || JSON.parse(localStorage.getItem('myco:auth') || 'null');
  const emailHint = meta?.email || 'sua conta';

  const brand = h('div', { class: 'brand-mark' },
    h('span', { class: 'brand-sigil' }, icon('lock')),
    h('span', { class: 'brand-name' }, 'myco'),
  );

  const errSlot = h('div');

  const pwd = h('input', {
    type: 'password',
    autocomplete: 'current-password',
    enterkeyhint: 'go',
    placeholder: 'sua senha',
    required: true,
  });

  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Entrar');

  const form = h('form', {
    onSubmit: async (e) => {
      e.preventDefault();
      errSlot.innerHTML = '';
      const pwdV = pwd.value;
      if (!pwdV) return;
      submit.disabled = true;
      submit.textContent = 'Aguarde…';
      try {
        const m = await unlockWithPassword(pwdV);
        const data = await loadEncryptedData({ allowCreate: true });
        setSession(data, m);
        navigate('/');
      } catch (e) {
        errSlot.appendChild(errorBox(e.message || 'Não consegui entrar.'));
        submit.disabled = false;
        submit.textContent = 'Entrar';
      }
    },
  },
    h('div', { class: 'field' },
      h('label', null, 'Sua senha'),
      pwd,
      h('div', { class: 'hint' }, `Conta neste celular: ${emailHint}`),
    ),
    errSlot,
    submit,
  );

  card.appendChild(brand);
  card.appendChild(h('h1', null, 'Entrar no seu jardim'));
  card.appendChild(h('p', { class: 'sub' }, 'Digite a senha que você criou — ela destranca os dados deste celular.'));
  card.appendChild(form);

  return wrap;
}
