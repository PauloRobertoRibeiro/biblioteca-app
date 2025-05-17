// Dados iniciais
let usuarios = [
  { nome: "admin", senha: "admin123", tipo: "admin" },
  { nome: "vendedor", senha: "venda123", tipo: "vendedor" }
];

let usuarioAtual = null;
let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
let livros = JSON.parse(localStorage.getItem("livros")) || [];
let emprestimos = JSON.parse(localStorage.getItem("emprestimos")) || [];
let historico = JSON.parse(localStorage.getItem("historico")) || [];
let caixa = parseFloat(localStorage.getItem("caixa")) || 0;

// ========== LOGIN ==========
function fazerLogin() {
  const nome = document.getElementById("loginNome").value;
  const senha = document.getElementById("loginSenha").value;
  const usuario = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (usuario) {
    usuarioAtual = usuario;
    document.getElementById("formLogin").style.display = "none";
    document.getElementById("conteudoSistema").style.display = "block";
    document.getElementById("usuarioLogado").innerText = usuario.nome;

    if (usuario.tipo === "vendedor") {
      document.getElementById("cadastroLivroSection").style.display = "none";
      document.getElementById("cadastroClienteSection").style.display = "none";
      document.getElementById("devolucaoVendaSection").style.display = "none";
    }

    atualizarInterface();
  } else {
    document.getElementById("erroLogin").innerText = "Usuário ou senha incorretos.";
  }
}

function logout() {
  usuarioAtual = null;
  document.getElementById("formLogin").style.display = "block";
  document.getElementById("conteudoSistema").style.display = "none";
  document.getElementById("loginNome").value = "";
  document.getElementById("loginSenha").value = "";
}

// ========== CLIENTES ==========
function cadastrarCliente() {
  const nome = document.getElementById("nomeCliente").value.trim();
  const telefone = document.getElementById("telefoneCliente").value.trim();
  const codigo = document.getElementById("codigoCliente").value.trim();

  if (!nome || !telefone) return alert("Preencha nome e telefone.");

  if (clientes.some(c => c.nome === nome)) {
    if (!confirm("Cliente já cadastrado. Deseja continuar?")) return;
  }

  clientes.push({ nome, telefone, codigo });
  salvarDados();
  atualizarInterface();
  document.getElementById("nomeCliente").value = "";
  document.getElementById("telefoneCliente").value = "";
  document.getElementById("codigoCliente").value = "";
}

// ========== LIVROS ==========
function cadastrarLivro() {
  const titulo = document.getElementById("tituloLivro").value.trim();
  const autor = document.getElementById("autorLivro").value.trim();
  const preco = parseFloat(document.getElementById("precoLivro").value);
  const quantidade = parseInt(document.getElementById("quantidadeLivro").value);
  const codigo = document.getElementById("codigoLivro").value.trim();

  if (!titulo || !autor || isNaN(preco) || isNaN(quantidade)) {
    return alert("Preencha todos os campos do livro.");
  }

  if (livros.some(l => l.titulo === titulo)) {
    if (!confirm("Livro já cadastrado. Deseja continuar?")) return;
  }

  livros.push({ titulo, autor, preco, quantidade, codigo });
  salvarDados();
  atualizarInterface();
  document.getElementById("tituloLivro").value = "";
  document.getElementById("autorLivro").value = "";
  document.getElementById("precoLivro").value = "";
  document.getElementById("quantidadeLivro").value = "";
  document.getElementById("codigoLivro").value = "";
}

// ========== EMPRÉSTIMO ==========
function emprestarLivro() {
  const cliente = document.getElementById("clienteEmprestimo").value;
  const livro = document.getElementById("livroEmprestimo").value;
  const l = livros.find(l => l.titulo === livro);
  if (!cliente || !livro || !l || l.quantidade <= 0) return alert("Selecione cliente e livro disponível.");

  emprestimos.push({ cliente, livro });
  l.quantidade--;
  historico.push(`Empréstimo: ${livro} para ${cliente}`);
  salvarDados();
  atualizarInterface();
}

// ========== VENDA ==========
function venderLivro() {
  const titulo = document.getElementById("tituloVenda").value;
  const livro = livros.find(l => l.titulo === titulo);
  if (!livro || livro.quantidade <= 0) return alert("Livro não disponível.");

  caixa += livro.preco;
  livro.quantidade--;
  historico.push(`Venda: ${livro.titulo} (€${livro.preco.toFixed(2)})`);
  salvarDados();
  atualizarInterface();
}

// ========== DEVOLUÇÃO DE EMPRÉSTIMO ==========
function devolverLivroEmprestado() {
  const cliente = document.getElementById("clienteDevolucao").value;
  const livro = document.getElementById("livroDevolucao").value;
  const index = emprestimos.findIndex(e => e.cliente === cliente && e.livro === livro);
  if (index === -1) return alert("Empréstimo não encontrado.");

  const l = livros.find(l => l.titulo === livro);
  if (l) l.quantidade++;
  emprestimos.splice(index, 1);
  historico.push(`Devolução (empréstimo): ${livro} de ${cliente}`);
  salvarDados();
  atualizarInterface();
}

// ========== DEVOLUÇÃO DE VENDA ==========
function devolverLivroVendido() {
  const titulo = document.getElementById("tituloDevolucaoVenda").value;
  const livro = livros.find(l => l.titulo === titulo);
  if (!livro) return alert("Livro não encontrado.");

  caixa -= livro.preco;
  livro.quantidade++;
  historico.push(`Devolução com reembolso: ${titulo} (-€${livro.preco.toFixed(2)})`);
  salvarDados();
  atualizarInterface();
}

// ========== INTERFACE ==========
function atualizarInterface() {
  document.getElementById("caixaTotal").innerText = `€ ${caixa.toFixed(2)}`;

  atualizarSelect("clienteEmprestimo", clientes.map(c => c.nome));
  atualizarSelect("clienteDevolucao", clientes.map(c => c.nome));
  atualizarSelect("livroEmprestimo", livros.filter(l => l.quantidade > 0).map(l => l.titulo));
  atualizarSelect("livroDevolucao", emprestimos.map(e => e.livro));
  atualizarSelect("tituloVenda", livros.filter(l => l.quantidade > 0).map(l => l.titulo));
  atualizarSelect("tituloDevolucaoVenda", livros.map(l => l.titulo));

  const listaLivros = document.getElementById("listaLivros");
  listaLivros.innerHTML = livros.map(l => `<li>${l.titulo} - ${l.quantidade} und</li>`).join("");

  document.getElementById("clientesDropdown").innerHTML = clientes.map(c => `<div>${c.nome} - ${c.telefone}</div>`).join("");
  document.getElementById("livrosDropdown").innerHTML = livros.map(l => `<div>${l.titulo} - €${l.preco.toFixed(2)} (${l.quantidade})</div>`).join("");
  document.getElementById("historicoDropdown").innerHTML = historico.slice(-20).map(h => `<div>${h}</div>`).join("");
}

function atualizarSelect(id, itens) {
  const select = document.getElementById(id);
  select.innerHTML = itens.map(i => `<option value="${i}">${i}</option>`).join("");
}

function toggleDropdown(id) {
  const div = document.getElementById(id);
  div.style.display = div.style.display === "block" ? "none" : "block";
}

// ========== LOCAL STORAGE ==========
function salvarDados() {
  localStorage.setItem("clientes", JSON.stringify(clientes));
  localStorage.setItem("livros", JSON.stringify(livros));
  localStorage.setItem("emprestimos", JSON.stringify(emprestimos));
  localStorage.setItem("historico", JSON.stringify(historico));
  localStorage.setItem("caixa", caixa.toString());
}
