// ======================= DADOS INICIAIS =======================
let usuarios = [
  { nome: "admin", senha: "admin123", tipo: "admin" },
  { nome: "vendedor", senha: "venda123", tipo: "vendedor" }
];

let usuarioAtual = null;
let clientes     = JSON.parse(localStorage.getItem("clientes"))     || [];
let livros       = JSON.parse(localStorage.getItem("livros"))       || [];
let emprestimos  = JSON.parse(localStorage.getItem("emprestimos"))  || [];
let historico    = JSON.parse(localStorage.getItem("historico"))    || [];
let caixa        = parseFloat(localStorage.getItem("caixa"))        || 0;

// ========================== LOGIN =============================
function fazerLogin() {
  const nome  = document.getElementById("loginNome").value;
  const senha = document.getElementById("loginSenha").value;
  const usuario = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (!usuario) {
    document.getElementById("erroLogin").innerText = "Usuário ou senha incorretos.";
    return;
  }

  usuarioAtual = usuario;
  document.getElementById("formLogin").style.display     = "none";
  document.getElementById("conteudoSistema").style.display = "block";
  document.getElementById("usuarioLogado").innerText = usuario.nome;
  document.getElementById("erroLogin").innerText = "";

  const vender      = document.getElementById("devolucaoVendaSection");
  const cadCliente  = document.getElementById("cadastroClienteSection");
  const cadLivro    = document.getElementById("cadastroLivroSection");

  if (usuario.tipo === "vendedor") {
    vender.style.display     = "none";
    cadCliente.style.display = "none";
    cadLivro.style.display   = "none";
  } else {
    vender.style.display     = "block";
    cadCliente.style.display = "block";
    cadLivro.style.display   = "block";
  }
  atualizarInterface();
}

function limparErroLogin() {
  document.getElementById("erroLogin").innerText = "";
}

function logout() {
  usuarioAtual = null;
  document.getElementById("formLogin").style.display = "block";
  document.getElementById("conteudoSistema").style.display = "none";
  document.getElementById("loginNome").value  = "";
  document.getElementById("loginSenha").value = "";
  document.getElementById("erroLogin").innerText = "";
}

// ======= SCANNER ISBN (html5‑qrcode) ==========================
let html5QrCode   = null;
let scannerRunning = false;

function startScanner() {
  if (scannerRunning) return;

  html5QrCode = new Html5Qrcode("reader");
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.UPC_A
    ]
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    decodedText => {
      document.getElementById("isbnLivro").value = decodedText;
      buscarISBN();
      stopScanner();
    },
    () => {} // ignora erros de leitura
  ).then(() => scannerRunning = true)
   .catch(err => alert("Erro ao iniciar scanner: " + err));
}

function stopScanner() {
  if (!scannerRunning || !html5QrCode) return;
  html5QrCode.stop()
    .then(() => {
      html5QrCode.clear();
      document.getElementById("reader").innerHTML = "";
      scannerRunning = false;
    })
    .catch(err => console.error("Erro ao parar scanner:", err));
}

// ============= BUSCAR DADOS PELO ISBN ========================
async function buscarISBN() {
  const isbn = document.getElementById("isbnLivro").value.trim();
  if (!isbn) { alert("Digite o ISBN."); return; }

  try {
    const res  = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    if (!data.totalItems) throw new Error("Livro não encontrado.");

    const info = data.items[0].volumeInfo;
    document.getElementById("tituloLivro").value  = info.title  || "";
    document.getElementById("autorLivro").value   = (info.authors || []).join(", ");
    document.getElementById("generoLivro").value  = (info.categories || [""]).shift();

    if (info.imageLinks?.thumbnail) {
      let img = document.getElementById("capaLivro");
      if (!img) {
        img = document.createElement("img");
        img.id = "capaLivro";
        img.style.maxWidth = "120px";
        document.getElementById("cadastroLivroSection").appendChild(img);
      }
      img.src = info.imageLinks.thumbnail;
    }
    alert("Dados preenchidos! Confira e salve.");
  } catch (err) {
    alert(err.message);
  }
}

// ==================== CLIENTES ===============================
function cadastrarCliente() {
  const nome  = document.getElementById("nomeCliente").value.trim();
  const tel   = document.getElementById("telefoneCliente").value.trim();
  const codigo= document.getElementById("codigoCliente").value.trim();
  if (!nome || !tel) return alert("Preencha nome e telefone.");

  if (clientes.some(c => c.nome === nome) && !confirm("Cliente já existe. Continuar?")) return;
  clientes.push({ nome, telefone: tel, codigo });
  salvarDados(); atualizarInterface();

  document.getElementById("nomeCliente").value  = "";
  document.getElementById("telefoneCliente").value = "";
  document.getElementById("codigoCliente").value   = "";
}

// ===================== LIVROS ================================
function cadastrarLivro() {
  const titulo = document.getElementById("tituloLivro").value.trim();
  const autor  = document.getElementById("autorLivro").value.trim();
  const preco  = parseFloat(document.getElementById("precoLivro").value);
  const quant  = parseInt(document.getElementById("quantidadeLivro").value);
  const codigo = document.getElementById("codigoLivro").value.trim();
  const genero = document.getElementById("generoLivro").value.trim();

  if (!titulo || !autor || isNaN(preco) || isNaN(quant) || !genero)
    return alert("Preencha todos os campos.");

  if (livros.some(l => l.titulo === titulo) && !confirm("Livro já existe. Continuar?")) return;
  livros.push({ titulo, autor, preco, quantidade: quant, codigo, genero });
  salvarDados(); atualizarInterface();

  ["tituloLivro","autorLivro","precoLivro","quantidadeLivro",
   "codigoLivro","generoLivro"].forEach(id => document.getElementById(id).value = "");
}

// ==================== EMPRÉSTIMO / VENDA =====================
function emprestarLivro() {
  const cliente = document.getElementById("clienteEmprestimo").value;
  const livro   = document.getElementById("livroEmprestimo").value;
  const l = livros.find(x => x.titulo === livro);
  if (!cliente || !l || l.quantidade <= 0) return alert("Selecione cliente e livro disponível.");

  emprestimos.push({ cliente, livro });
  l.quantidade--;
  historico.push(`Empréstimo: ${livro} para ${cliente}`);
  salvarDados(); atualizarInterface();
}

function venderLivro() {
  const titulo = document.getElementById("tituloVenda").value;
  const livro  = livros.find(l => l.titulo === titulo);
  if (!livro || livro.quantidade <= 0) return alert("Livro não disponível.");

  caixa += livro.preco; livro.quantidade--;
  historico.push(`Venda: ${livro.titulo} (€${livro.preco.toFixed(2)})`);
  salvarDados(); atualizarInterface();
}

// =================== DEVOLUÇÕES ==============================
function devolverLivroEmprestado() {
  const sel = document.getElementById("livroDevolucao").value;
  if (!sel) return alert("Selecione um empréstimo.");
  const [cliente, livro] = sel.split(" - ");
  const idx = emprestimos.findIndex(e => e.cliente === cliente && e.livro === livro);
  if (idx === -1) return alert("Empréstimo não encontrado.");

  const l = livros.find(x => x.titulo === livro);
  if (l) l.quantidade++;
  emprestimos.splice(idx,1);
  historico.push(`Devolução: ${livro} de ${cliente}`);
  salvarDados(); atualizarInterface();
}

function devolverLivroVendido() {
  const titulo = document.getElementById("tituloDevolucaoVenda").value;
  const livro  = livros.find(l => l.titulo === titulo);
  if (!livro) return alert("Livro não encontrado.");

  caixa -= livro.preco; livro.quantidade++;
  historico.push(`Reembolso: ${titulo} (-€${livro.preco.toFixed(2)})`);
  salvarDados(); atualizarInterface();
}

// ================== INTERFACE / DROPDOWNS ====================
function atualizarInterface() {
  document.getElementById("caixaTotal").innerText = `€ ${caixa.toFixed(2)}`;

  atualizarSelect("clienteEmprestimo", clientes.map(c => c.nome));
  atualizarSelect("clienteDevolucao", clientes.map(c => c.nome));
  atualizarSelect("livroEmprestimo", livros.filter(l => l.quantidade > 0).map(l => l.titulo));
  atualizarSelect("livroDevolucao", emprestimos.map(e => `${e.cliente} - ${e.livro}`));
  atualizarSelect("tituloVenda", livros.filter(l => l.quantidade > 0).map(l => l.titulo));
  atualizarSelect("tituloDevolucaoVenda", livros.map(l => l.titulo));

  document.getElementById("listaLivros").innerHTML =
    livros.map(l => `<li>${l.titulo} (${l.genero}) - ${l.quantidade} und</li>`).join("");

  document.getElementById("clientesDropdown").innerHTML =
    clientes.map(c => `<div>${c.nome} - ${c.telefone}</div>`).join("");

  document.getElementById("livrosDropdown").innerHTML =
    livros.map(l => `<div>${l.titulo} (${l.genero}) - €${l.preco.toFixed(2)} (${l.quantidade})</div>`).join("");

  document.getElementById("historicoDropdown").innerHTML =
    historico.slice(-20).map(h => `<div>${h}</div>`).join("");

  // fecha menus para garantir toggle correto
  ["clientesDropdown","livrosDropdown","historicoDropdown"].forEach(id =>
    document.getElementById(id).style.display = "none");
}

function atualizarSelect(id, itens) {
  const sel = document.getElementById(id);
  sel.innerHTML = itens.map(x => `<option value="${x}">${x}</option>`).join("");
}

function toggleDropdown(id) {
  const div = document.getElementById(id);
  const aberto = div.style.display === "block";
  div.style.display = aberto ? "none" : "block";
}

// ================ SALVAR / LOAD ==============================
function salvarDados() {
  localStorage.setItem("clientes",    JSON.stringify(clientes));
  localStorage.setItem("livros",      JSON.stringify(livros));
  localStorage.setItem("emprestimos", JSON.stringify(emprestimos));
  localStorage.setItem("historico",   JSON.stringify(historico));
  localStorage.setItem("caixa",       String(caixa));
}

// ================ LISTENERS INICIAIS =========================
document.getElementById("loginNome" ).addEventListener("input", limparErroLogin);
document.getElementById("loginSenha").addEventListener("input", limparErroLogin);

window.onload = atualizarInterface;
