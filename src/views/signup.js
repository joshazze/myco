import { h, icon, errorBox } from '../components/ui.js';
import { signup } from '../lib/auth.js';
import { loadEncryptedData } from '../lib/storage.js';
import { setSession } from '../lib/state.js';
import { navigate } from '../lib/router.js';

export async function renderSignup() {
  const wrap = h('div', { class: 'auth-wrap' });
  const card = h('div', { class: 'auth-card glow-card' });
  wrap.appendChild(card);

  const brand = h('div', { class: 'brand-mark' },
    h('span', { class: 'brand-sigil' }, icon('leaf')),
    h('span', { class: 'brand-name' }, 'myco'),
  );

  const errSlot = h('div');

  const email = h('input', {
    type: 'email',
    autocomplete: 'email',
    inputmode: 'email',
    enterkeyhint: 'next',
    placeholder: 'voce@exemplo.com',
    required: true,
  });
  const pwd = h('input', {
    type: 'password',
    autocomplete: 'new-password',
    enterkeyhint: 'next',
    placeholder: 'pelo menos 8 caracteres',
    minlength: '8',
    required: true,
  });
  const confirm = h('input', {
    type: 'password',
    autocomplete: 'new-password',
    enterkeyhint: 'done',
    placeholder: 'repita a senha igual',
    minlength: '8',
    required: true,
  });

  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Criar minha conta');

  const form = h('form', {
    onSubmit: async (e) => {
      e.preventDefault();
      errSlot.innerHTML = '';
      const emailV = email.value.trim();
      const pwdV = pwd.value;
      const confV = confirm.value;
      if (!emailV || !/.+@.+\..+/.test(emailV)) {
        errSlot.appendChild(errorBox('Email inválido.'));
        return;
      }
      if (pwdV.length < 8) {
        errSlot.appendChild(errorBox('Senha precisa ter ao menos 8 caracteres.'));
        return;
      }
      if (pwdV !== confV) {
        errSlot.appendChild(errorBox('As senhas não conferem.'));
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Aguarde, preparando seu jardim…';
      try {
        const meta = await signup(emailV, pwdV);
        const data = await loadEncryptedData({ allowCreate: true });
        setSession(data, meta);
        navigate('/backup?firstRun=1');
      } catch (e) {
        errSlot.appendChild(errorBox(e.message || 'Falha ao criar conta.'));
        submit.disabled = false;
        submit.textContent = 'Criar minha conta';
      }
    },
  },
    h('div', { class: 'field' }, h('label', null, 'Seu email'), email),
    h('div', { class: 'field' },
      h('label', null, 'Senha'),
      pwd,
      h('div', { class: 'hint' },
        'Essa senha tranca tudo no seu celular. Guarde com você — se esquecer, ',
        'só recupera com um backup feito antes.',
      ),
    ),
    h('div', { class: 'field' }, h('label', null, 'Confirmar a senha'), confirm),
    errSlot,
    submit,
  );

  card.appendChild(brand);
  card.appendChild(h('h1', null, 'Bem-vindo ao myco'));
  card.appendChild(h('p', { class: 'sub' },
    'Crie sua conta neste celular. Tudo fica salvo aqui, ',
    'em segredo — nada vai pra internet.',
  ));
  card.appendChild(form);

  return wrap;
}
