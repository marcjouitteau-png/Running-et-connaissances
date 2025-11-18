// Vercel Serverless Function (CommonJS)
const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // Body JSON (sécurisé)
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  // Honeypot anti-spam
  if (body._honey) return res.status(200).json({ ok: true });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminEmail = process.env.ADMIN_EMAIL || 'runningconnaissances@gmail.com';
    const from = process.env.MAIL_FROM || 'Courir Autrement <onboarding@resend.dev>';

    // Mise en forme lisible des champs
    const html = `
      <h2>Nouvelle inscription</h2>
      ${Object.entries(body)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => `<p><strong>${k}</strong><br>${String(v ?? '').replace(/\n/g,'<br>')}</p>`)
        .join('')}
    `;

    // Envoi vers l’admin
    await resend.emails.send({
      from,
      to: adminEmail,
      subject: 'Nouvelle inscription – Courir Autrement',
      html
      // NOTE: on peut ajouter replyTo plus tard si besoin
      // replyTo: body['E-mail'] || body['Email']
    });

    // (Optionnel) accusé de réception au participant
    if (body['E-mail'] || body['Email']) {
      const userEmail = body['E-mail'] || body['Email'];
      await resend.emails.send({
        from,
        to: userEmail,
        subject: 'Nous avons bien reçu votre inscription',
        html: `<p>Bonjour ${body['Nom et prénom'] || ''},</p><p>Merci ! Nous revenons vers vous très vite.</p>`
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).send('Erreur envoi email');
  }
};
