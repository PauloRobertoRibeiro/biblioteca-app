/* ==============================================================
   BIBLIOTECA – CONTROLE DE LIVROS
   ==============================================================
   Recursos:
   • login (admin / vendedor)
   • cadastro de clientes e livros
   • empréstimo / venda / devolução
   • filtros + busca
   • exportação JSON / CSV
   • painel de estatísticas
   • níveis de acesso + log de ações
   ==============================================================*/


// ======================= DADOS INICIAIS =======================
const usuarios = [
  { nome: "admin",    senha: "admin123", tipo: "admin"     },
  { nome: "vendedor", senha: "venda123", tipo: "vendedor"  }
];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('Service Worker registrado com sucesso:', reg);
      })
      .catch(err => {
        console.error('Falha ao registrar o Service Worker:', err);
      });
  });
}



let usuarioAtual = null;

let clientes     = JSON.parse(localStorage.getItem("clientes"))     || [];
let livros       = JSON.parse(localStorage.getItem("livros"))       || [];
let emprestimos  = JSON.parse(localStorage.getItem("emprestimos"))  || [];
let historico    = JSON.parse(localStorage.getItem("historico"))    || [];
let vendas       = JSON.parse(localStorage.getItem("vendas"))       || [];
let logAcoes     = JSON.parse(localStorage.getItem("logAcoes"))     || [];
let caixa        = parseFloat(localStorage.getItem("caixa"))        || 0;


// --------------------- MAPA DE PERMISSÕES --------------------
const PERMISSOES = {
  CAD_CLIENTE      : ["admin"],
  CAD_LIVRO        : ["admin"],
  DEVOLUCAO_VENDA  : ["admin"],
  EXPORTAR         : ["admin","vendedor"],
  EMPRESTIMO       : ["admin","vendedor"],
  VENDA            : ["admin","vendedor"]
};
const temPermissao = acao =>
  usuarioAtual && PERMISSOES[acao]?.includes(usuarioAtual.tipo);


// ------------------------ LOG DE AÇÕES -----------------------
function registrarAcao(tipo, detalhes="") {
  const item = {
    usuario : usuarioAtual ? usuarioAtual.nome : "desconhecido",
    tipo, detalhes,
    dataISO : new Date().toISOString()
  };
  logAcoes.push(item);
  localStorage.setItem("logAcoes", JSON.stringify(logAcoes));
}


// ------------------ PERSISTÊNCIA LOCAL -----------------------
function salvarDados() {
  localStorage.setItem("clientes",    JSON.stringify(clientes));
  localStorage.setItem("livros",      JSON.stringify(livros));
  localStorage.setItem("emprestimos", JSON.stringify(emprestimos));
  localStorage.setItem("historico",   JSON.stringify(historico));
  localStorage.setItem("vendas",      JSON.stringify(vendas));
  localStorage.setItem("logAcoes",    JSON.stringify(logAcoes));
  localStorage.setItem("caixa",       String(caixa));
}


// ============================================================
//                        LOGIN / LOGOUT
// ============================================================
function fazerLogin() {
  const nome  = document.getElementById("loginNome").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();
  const usuario = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (!usuario) {
    document.getElementById("erroLogin").innerText = "Usuário ou senha incorretos.";
    return;
  }
  usuarioAtual = usuario;
  registrarAcao("LOGIN","Login realizado");

  document.getElementById("formLogin").style.display      = "none";
  document.getElementById("conteudoSistema").style.display = "block";
  document.getElementById("usuarioLogado").innerText       = usuario.nome;
  document.getElementById("erroLogin").innerText           = "";

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
  atualizarPainelEstatisticas();
}

function logout() {
  registrarAcao("LOGOUT","Logout realizado");
  usuarioAtual = null;
  document.getElementById("formLogin").style.display      = "block";
  document.getElementById("conteudoSistema").style.display = "none";
  document.getElementById("loginNome").value  = "";
  document.getElementById("loginSenha").value = "";
  document.getElementById("erroLogin").innerText = "";
}


// ============================================================
//                     CADASTRO DE CLIENTES
// ============================================================
function cadastrarCliente() {
  if(!temPermissao("CAD_CLIENTE")) return alert("Sem permissão.");

  const nome   = document.getElementById("nomeCliente").value.trim();
  const tel    = document.getElementById("telefoneCliente").value.trim();
  const codigo = document.getElementById("codigoCliente").value.trim();

  if (!nome || !tel) return alert("Preencha nome e telefone.");

  if (clientes.some(c => c.nome === nome) &&
      !confirm("Cliente já existe. Continuar?")) return;

  clientes.push({ nome, telefone: tel, codigo });
  registrarAcao("CAD_CLIENTE",`Cliente: ${nome}`);

  salvarDados();
  atualizarInterface();
  atualizarPainelEstatisticas();
  ["nomeCliente","telefoneCliente","codigoCliente"].forEach(id => document.getElementById(id).value = "");
}


// ============================================================
//                     CADASTRO DE LIVROS
// ============================================================
function cadastrarLivro() {
  if(!temPermissao("CAD_LIVRO")) return alert("Sem permissão.");

  const titulo = document.getElementById("tituloLivro").value.trim();
  const autor  = document.getElementById("autorLivro").value.trim();
  const preco  = parseFloat(document.getElementById("precoLivro").value);
  const quant  = parseInt(document.getElementById("quantidadeLivro").value);
  const codigo = document.getElementById("codigoLivro").value.trim();
  const genero = document.getElementById("generoLivro").value.trim();

  if (!titulo || !autor || isNaN(preco) || isNaN(quant) || !genero)
    return alert("Preencha todos os campos.");

  if (livros.some(l => l.titulo === titulo) &&
      !confirm("Livro já existe. Continuar?")) return;

  livros.push({ titulo, autor, preco, quantidade: quant, codigo, genero });
  registrarAcao("CAD_LIVRO",`Livro: ${titulo}`);

  salvarDados();
  atualizarInterface();
  ["tituloLivro","autorLivro","precoLivro","quantidadeLivro","codigoLivro","generoLivro"]
    .forEach(id => document.getElementById(id).value = "");
}

async function buscarISBN() {
  const isbn = document.getElementById("isbnLivro").value.trim().replace(/[^0-9X]/gi,'');
  if (!isbn) { alert("Informe um ISBN"); return; }

  try {
    // Open Library API
    const url  = `https://openlibrary.org/isbn/${isbn}.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("ISBN não encontrado");

    const data = await resp.json();

    // Preenche campos se existirem no DOM
    if (data.title)  document.getElementById("tituloLivro").value = data.title;
    if (data.by_statement) {
      document.getElementById("autorLivro").value = data.by_statement;
    } else if (data.authors?.length) {
      // Busca nome do primeiro autor
      const authorResp = await fetch(`https://openlibrary.org${data.authors[0].key}.json`);
      if (authorResp.ok) {
        const author = await authorResp.json();
        document.getElementById("autorLivro").value = author.name || "";
      }
    }

    // Gênero: OpenLibrary não traz um “genre” simples, então deixamos vazio.
    // Você pode mapear por subject depois se quiser.

    alert("Dados do ISBN carregados. Confira e complete o cadastro.");
  } catch (e) {
    console.error(e);
    alert("Não foi possível encontrar informações para esse ISBN.");
  }
}

// ================= LEITOR DE CÓDIGO DE BARRAS =================
let html5QrCode = null;
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
    (decodedText) => {
      document.getElementById("isbnLivro").value = decodedText;
      buscarISBN();
      stopScanner();
    }
  ).then(() => {
    scannerRunning = true;
  }).catch(err => console.error("Erro ao iniciar scanner:", err));
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

// ===== BUSCA ISBN (Open Library) =========================
async function buscarISBN() {
  const isbn = document
      .getElementById("isbnLivro")
      .value.trim()
      .replace(/[^0-9X]/gi, "");          // mantém dígitos ou X

  if (!isbn) return alert("Digite um ISBN válido.");

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const info = data[`ISBN:${isbn}`];
    if (!info) return alert("ISBN não encontrado.");

    const titulo  = info.title || "";
    const autor   = (info.authors && info.authors[0]?.name) || "";
    const capaUrl = info.cover?.medium || info.cover?.large || info.cover?.small || "";

    document.getElementById("tituloLivro").value = titulo;
    document.getElementById("autorLivro").value  = autor;

    const img = document.getElementById("capaPreview");
    if (capaUrl) {
      img.src = capaUrl.replace(/^http:/, "https:"); // força https
      img.style.display = "block";
    } else {
      img.style.display = "none";
    }

    document.getElementById("precoLivro").value      ||= "0";
    document.getElementById("quantidadeLivro").value ||= "1";
  } catch (err) {
    console.error("Erro na busca ISBN:", err);
    alert("Falha ao buscar dados. Verifique a conexão.");
  }
}




// ============================================================
//                  EMPRÉSTIMO / VENDA / DEVOLUÇÃO
// ============================================================
function emprestarLivro() {
  if(!temPermissao("EMPRESTIMO")) return alert("Sem permissão.");

  const cliente = document.getElementById("clienteEmprestimo").value;
  const livro   = document.getElementById("livroEmprestimo").value;
  const l = livros.find(x => x.titulo === livro);

  if (!cliente || !l || l.quantidade <= 0)
    return alert("Selecione cliente e livro disponível.");

  emprestimos.push({ cliente, livro, data: new Date().toISOString() });
  l.quantidade--;
  historico.push(`Empréstimo: ${livro} para ${cliente}`);
  registrarAcao("EMPRESTIMO",`Livro "${livro}" → ${cliente}`);

  salvarDados();
  atualizarInterface();
  atualizarPainelEstatisticas();
}

function venderLivro() {
  if(!temPermissao("VENDA")) return alert("Sem permissão.");

  const titulo = document.getElementById("tituloVenda").value;
  const livro  = livros.find(l => l.titulo === titulo);

  if (!livro || livro.quantidade <= 0) return alert("Livro não disponível.");

  caixa += livro.preco;
  livro.quantidade--;

  vendas.push({
    titulo,
    valor: livro.preco,
    data: new Date().toISOString(),
    idCliente: usuarioAtual?.nome || null
  });
  historico.push(`Venda: ${livro.titulo} (€${livro.preco.toFixed(2)})`);
  registrarAcao("VENDA",`Livro "${titulo}" (€${livro.preco})`);

  salvarDados();
  atualizarInterface();
  atualizarPainelEstatisticas();
}

function devolverLivroVendido() {
  if(!temPermissao("DEVOLUCAO_VENDA")) return alert("Sem permissão.");

  const titulo = document.getElementById("tituloDevolucaoVenda").value;
  const livro  = livros.find(l => l.titulo === titulo);
  if (!livro) return alert("Livro não encontrado.");

  caixa -= livro.preco;
  livro.quantidade++;
  historico.push(`Reembolso: ${titulo} (-€${livro.preco.toFixed(2)})`);
  registrarAcao("DEVOLUCAO_VENDA",`Livro "${titulo}"`);

  salvarDados();
  atualizarInterface();
  atualizarPainelEstatisticas();
}


// ============================================================
//                   EXPORTAR DADOS (JSON / CSV)
// ============================================================
function exportarJSON() {
  if(!temPermissao("EXPORTAR")) return alert("Sem permissão.");

  const dados = { clientes, livros, emprestimos, historico, vendas, caixa, logAcoes };
  const blob  = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });

  registrarAcao("EXPORTAR","JSON");
  baixarArquivo(blob, "biblioteca-backup.json");
}

function exportarCSV() {
  if(!temPermissao("EXPORTAR")) return alert("Sem permissão.");

  const cabec  = "titulo;autor;genero;preco;quantidade;codigo\n";
  const linhas = livros.map(l =>
    [l.titulo, l.autor, l.genero, l.preco, l.quantidade, l.codigo]
      .map(c => `"${String(c).replace(/"/g,'""')}"`).join(";")
  ).join("\n");

  const blob = new Blob([cabec + linhas], { type: "text/csv" });

  registrarAcao("EXPORTAR","CSV Livros");
  baixarArquivo(blob, "livros.csv");
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}


// ============================================================
//                     ATUALIZAR INTERFACE
// ============================================================
function atualizarInterface() {

  // ---- caixa ----
  document.getElementById("caixaTotal").innerText = `€ ${caixa.toFixed(2)}`;

  // ---- selects ----
  preencherSelect("clienteEmprestimo",        clientes.map(c => c.nome));
  preencherSelect("livroEmprestimo",
                  livros.filter(l => l.quantidade>0).map(l => l.titulo));
  preencherSelect("livroDevolucao",
                  emprestimos.map(e => `${e.cliente} - ${e.livro}`));
  preencherSelect("tituloVenda",
                  livros.filter(l => l.quantidade>0).map(l => l.titulo));
  preencherSelect("tituloDevolucaoVenda",     livros.map(l => l.titulo));

  // ---- listas ----
  document.getElementById("listaLivros").innerHTML =
    livros.length
      ? livros.map(l =>
          `<li>${l.titulo} (${l.genero}) – ${l.quantidade} un.</li>`).join("")
      : "<em>Nenhum livro cadastrado.</em>";

  document.getElementById("clientesDropdown").innerHTML =
    clientes.map(c => `<div>${c.nome} – ${c.telefone}</div>`).join("");

  document.getElementById("livrosDropdown").innerHTML =
    livros.map(l =>
      `<div>${l.titulo} (${l.genero}) – €${l.preco.toFixed(2)} (${l.quantidade})</div>`
    ).join("");

  document.getElementById("historicoDropdown").innerHTML =
    historico.slice(-20).map(h => `<div>${h}</div>`).join("");

  // ---- filtro: lista de gêneros ----
  const generos = [...new Set(livros.map(l => l.genero).filter(Boolean))].sort();
  document.getElementById("generoFiltro").innerHTML =
      '<option value="">— Todos —</option>' +
      generos.map(g => `<option value="${g}">${g}</option>`).join("");

  // fecha dropdowns abertos
  ["clientesDropdown","livrosDropdown","historicoDropdown"].forEach(id =>
    document.getElementById(id).style.display = "none");

  // aplica filtros imediatamente
  filtrarLivros();
}

function preencherSelect(id, itens) {
  const sel = document.getElementById(id);
  sel.innerHTML = itens.map(v => `<option value="${v}">${v}</option>`).join("");
}

// ---------------------- FILTRO DE LIVROS ----------------------
function filtrarLivros() {
  const termo  = (document.getElementById("buscaInput")?.value || "").toLowerCase();
  const genero = document.getElementById("generoFiltro")?.value || "";
  const dispo  = document.getElementById("dispoFiltro")?.value || ""; // "", "sim", "nao"

  const lista = livros.filter(l => {
    const textoOK  =
      l.titulo.toLowerCase().includes(termo) ||
      l.autor.toLowerCase().includes(termo);

    const generoOK = !genero || l.genero === genero;

    const dispoOK  = dispo === "" ||
                     (dispo === "sim" && l.quantidade > 0) ||
                     (dispo === "nao" && l.quantidade === 0);

    return textoOK && generoOK && dispoOK;
  });

  document.getElementById("listaLivros").innerHTML =
    lista.length
      ? lista.map(l =>
          `<li>${l.titulo} (${l.genero}) – ${l.quantidade} un.</li>`).join("")
      : "<em>Nenhum livro encontrado.</em>";
}


// ============================================================
//                    PAINEL DE ESTATÍSTICAS
// ============================================================
function atualizarPainelEstatisticas() {
  const ul = document.getElementById("listaLivrosMaisEmprestados");
  if (!ul) return;

  // top 5 emprestados
  const cont = {};
  emprestimos.forEach(e => cont[e.livro] = (cont[e.livro]||0)+1);
  const top = Object.entries(cont).sort((a,b)=>b[1]-a[1]).slice(0,5);

  ul.innerHTML = "";
  top.forEach(([titulo, qtd]) => {
    const li = document.createElement("li");
    li.textContent = `${titulo} – ${qtd} empréstimos`;
    ul.appendChild(li);
  });

  // total de vendas do dia
  const hoje = new Date().toISOString().slice(0,10);
  const totalDia = vendas
    .filter(v => v.data && v.data.slice(0,10) === hoje)
    .reduce((s,v) => s + Number(v.valor||0), 0);
  document.getElementById("totalVendasDia").textContent =
    `€ ${totalDia.toFixed(2)}`;

  // clientes ativos 30 dias
  const limite = Date.now() - (30*24*60*60*1000);
  const ativos = new Set();
  emprestimos.forEach(e => {
    if (new Date(e.data).getTime() >= limite) ativos.add(e.cliente);
  });
  vendas.forEach(v => {
    if (new Date(v.data).getTime() >= limite && v.idCliente)
      ativos.add(v.idCliente);
  });
  document.getElementById("clientesAtivos").textContent = ativos.size;
}


// ============================================================
//                    OUTROS UTILITÁRIOS UI
// ============================================================
function toggleDropdown(id){
  const div = document.getElementById(id);
  div.style.display = div.style.display==="block" ? "none" : "block";
}

function limparErroLogin(){
  document.getElementById("erroLogin").innerText = "";
}


// ============================================================
//                    DISPARO INICIAL
// ============================================================
window.onload = () => {
  atualizarInterface();
  atualizarPainelEstatisticas();
};

// listeners p/ limpar aviso de erro de login
document.getElementById("loginNome" ).addEventListener("input", limparErroLogin);
document.getElementById("loginSenha").addEventListener("input", limparErroLogin);
