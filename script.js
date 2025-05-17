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
    document.getElementById("erroLogin").innerText = "";

    if (usuario.tipo === "vendedor") {
      document.getElementById("cadastroLivroSection").style.display = "none";
      document.getElementById("cadastroClienteSection").style.display = "none";
      document.getElementById("devolucaoVendaSection").style.display = "none";
    } else {
      document.getElementById("cadastroLivroSection").style.display = "block";
      document.getElementById("cadastroClienteSection").style.display = "block";
      document.getElementById("devolucaoVendaSection").style.display = "block";
    }

    atualizarInterface();
  } else {
    document.getElementById("erroLogin").innerText = "Usuário ou senha incorretos.";
  }
}

function limparErroLogin() {
  document.getElementById("erroLogin").innerText = "";
}

function logout() {
  usuarioAtual = null;
  document.getElementById("formLogin").style.display = "block";
  document.getElementById("conteudoSistema").style.display = "none";
  document.getElementById("loginNome").value = "";
  document.getElementById("loginSenha").value = "";
  document.getElementById("erroLogin").innerText = "";
}

// ========== SCANNER DE CÓDIGO DE BARRAS ==========
let html5QrCode = null;

function startScanner() {
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  const config = {
    fps: 10,
    qrbox: 250,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.UPC_A
    ]
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      alert(`Código lido: ${decodedText}`);
      document.getElementById("isbnLivro").value = decodedText;
      buscarISBN();
      stopScanner();
    },
    (errorMessage) => {
      // Pode mostrar erro se quiser
      // console.log("Erro leitura código: ", errorMessage);
    }
  ).then(() => {
    console.log("Scanner iniciado.");
  }).catch(err => {
    alert("Erro ao iniciar scanner: " + err);
  });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop()
      .then(() => {
        html5QrCode.clear();
        document.getElementById("reader").innerHTML = "";
        console.log("Scanner parado e interface limpa.");
      })
      .catch(err => console.error("Erro ao parar scanner:", err));
  }
}

// ========== BUSCAR LIVRO PELO ISBN ==========
async function buscarISBN() {
  const isbn = document.getElementById("isbnLivro").value.trim();
  if (!isbn) return alert("Digite o ISBN primeiro.");

  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.totalItems === 0) throw new Error("Livro não encontrado.");

    const info = data.items[0].volumeInfo;

    // Preenche campos
    document.getElementById("tituloLivro").value  = info.title || "";
    document.getElementById("autorLivro").value   = (info.authors || []).join(", ");
    document.getElementById("generoLivro").value  = (info.categories || [""]).shift();

    // Mostra capa se existir
    if (info.imageLinks && info.imageLinks.thumbnail) {
      let img = document.getElementById("capaLivro");
      if (!img) {
        img = document.createElement("img");
        img.id = "capaLivro";
        img.style.maxWidth = "120px";
        document.getElementById("cadastroLivroSection").appendChild(img);
      }
      img.src = info.imageLinks.thumbnail;
    }

    alert("Dados preenchidos com sucesso! Confira e salve.");
  } catch (err) {
    alert(err.message);
  }
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

  // Limpar campos
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
  const genero = document.getElementById("generoLivro").value.trim();

  if (!titulo || !autor || isNaN(preco) || isNaN(quantidade) || !genero) {
    return alert("Preencha todos os campos do livro, incluindo o gênero.");
  }

  if (livros.some(l => l.titulo === titulo)) {
    if (!confirm("Livro já cadastrado. Deseja continuar?")) return;
  }

  livros.push({ titulo, autor, preco, quantidade, codigo, genero });
  salvarDados();
  atualizarInterface();

  // Limpar campos
  document.getElementById("tituloLivro").value = "";
  document.getElementById("autorLivro").value = "";
  document.getElementById("precoLivro").value = "";
  document.getElementById("quantidadeLivro").value = "";
  document.getElementById("codigoLivro").value = "";
  document.getElementById("generoLivro").value = "";
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
  const selecionado = document.getElementById("livroDevolucao").value;
  if (!selecionado) return alert("Selecione um empréstimo para devolver.");

  // Espera formato "Cliente - Livro"
  const [cliente, livro] = selecionado.split(" - ");

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

  // Para devolução de empréstimos, mostrar "Cliente - Livro"
  atualizarSelect("livroDevolucao", emprestimos.map(e => `${e.cliente} - ${e.livro}`));

  atualizarSelect("tituloVenda", livros.filter(l => l.quantidade > 0).map(l => l.titulo));
  atualizarSelect("tituloDevolucaoVenda", livros.map(l => l.titulo));
}
  // List
