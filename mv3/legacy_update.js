document.querySelectorAll('[trans]').forEach(node => { node.textContent = t(node.getAttribute('trans')); });
document.querySelectorAll('.main h3').forEach(heading => {
  const id = `v${heading.textContent.slice(5).replace(/\s/g, '')}`;
  heading.id = id;
  const link = document.createElement('a'); link.href = `#${id}`; link.textContent = heading.textContent;
  const item = document.createElement('li'); item.append(link);
  document.querySelector('#scrollSpy ul')?.append(item);
  if (heading.dataset.date) {
    const date = document.createElement('small'); date.textContent = `Release Date: ${new Date(Number(heading.dataset.date)).toLocaleDateString()}`;
    heading.after(date);
  }
});
if (document.getElementById('footerYear')) document.getElementById('footerYear').textContent = new Date().getFullYear();
