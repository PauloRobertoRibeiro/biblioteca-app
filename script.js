const usuarios = [
  { nome: "admin", senha: "admin123", tipo: "admin" },
  { nome: "vendedor", senha: "venda123", tipo: "vendedor" }
];

const storage = {
  livros: "livros",
  clientes: "clientes",
  emprestimos: "emprestimos",
  historico: "historico",
  caixa: "caixa",
  reservas: "reservas",
  vendas: "vendas",
  acertos: "acertos",
  livrariaAtual: "livrariaAtual"
};

const livrariasPadrao = [
  { nome: "Abba Libreria Cristiana", margem: 15 },
  { nome: "Alfa Omega", margem: 4 }
];

const livrariaInicial = livrariasPadrao[0].nome;

let usuarioAtual = null;
let livros = carregar(storage.livros, []);
let clientes = carregar(storage.clientes, []);
let emprestimos = carregar(storage.emprestimos, []);
let reservas = carregar(storage.reservas, []);
let vendas = carregar(storage.vendas, []);
let acertos = carregar(storage.acertos, []);
let historico = carregar(storage.historico, []);
let caixa = Number(localStorage.getItem(storage.caixa) || 0);
let scannerStream = null;
let scannerTimer = null;
let barcodeDetector = null;
let html5QrCode = null;
let scannerAtivo = false;
let scannerParando = false;
let zxingReader = null;
let buscaCodigoTimer = null;
let scannerBusy = false;
let caixaVisivel = localStorage.getItem("caixaVisivel") === "true";
let calcValor = "0";
let whatsappIndice = 0;
let livroEditandoId = "";
let clienteEditandoId = "";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  normalizarDadosAntigos();
  criarDadosExemplo();
  bindEventos();
  $("origemLivro").value = livrariaAtual();
  aplicarPadraoLivraria();
  $("dataAcertoLivro").value = $("dataAcertoLivro").value || dataAcertoPadrao();
  renderizarTudo();
});

function carregar(chave, fallback) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || fallback;
  } catch {
    return fallback;
  }
}

function salvarDados() {
  localStorage.setItem(storage.livros, JSON.stringify(livros));
  localStorage.setItem(storage.clientes, JSON.stringify(clientes));
  localStorage.setItem(storage.emprestimos, JSON.stringify(emprestimos));
  localStorage.setItem(storage.reservas, JSON.stringify(reservas));
  localStorage.setItem(storage.vendas, JSON.stringify(vendas));
  localStorage.setItem(storage.acertos, JSON.stringify(acertos));
  localStorage.setItem(storage.historico, JSON.stringify(historico));
  localStorage.setItem(storage.caixa, String(caixa));
}

function normalizarDadosAntigos() {
  livros = livros.map((livro) => ({
    id: livro.id || cryptoId(),
    codigo: livro.codigo || "",
    titulo: livro.titulo || "Sem titulo",
    autor: livro.autor || "Autor desconhecido",
    editora: livro.editora || "",
    categoria: livro.categoria || "Geral",
    capa: livro.capa || capaPorIsbn(livro.codigo),
    preco: Number(livro.preco || 0),
    custo: Number(livro.custo || livro.preco || 0),
    margemPercent: Number.isFinite(Number(livro.margemPercent))
      ? Number(livro.margemPercent)
      : margemPorValores(livro.preco, livro.custo || livro.preco),
    quantidade: Number(livro.quantidade || 0),
    recebidos: Number(livro.recebidos || (Number(livro.quantidade || 0) + Number(livro.vendidos || 0) + Number(livro.devolvidos || 0))),
    vendidos: Number(livro.vendidos || 0),
    devolvidos: Number(livro.devolvidos || 0),
    origem: livro.origem || livrariaInicial,
    dataAcerto: livro.dataAcerto || dataAcertoPadrao(),
    criadoEm: livro.criadoEm || new Date().toISOString()
  }));

  clientes = clientes.map((cliente) => ({
    id: cliente.id || cryptoId(),
    nome: cliente.nome || "Cliente",
    telefone: cliente.telefone || "",
    codigo: cliente.codigo || "",
    criadoEm: cliente.criadoEm || new Date().toISOString()
  }));

  emprestimos = emprestimos.map((item) => ({
    id: item.id || cryptoId(),
    clienteId: item.clienteId || idOuVazio(buscarClientePorNome(item.cliente)),
    livroId: item.livroId || idOuVazio(buscarLivroPorTitulo(item.livro)),
    data: item.data || new Date().toISOString(),
    status: item.status || "ativo"
  }));

  reservas = reservas.map((item) => ({
    id: item.id || cryptoId(),
    clienteNome: item.clienteNome || item.cliente || "Cliente",
    telefone: item.telefone || "",
    livroId: item.livroId || idOuVazio(buscarLivroPorTitulo(item.livro)),
    data: item.data || new Date().toISOString(),
    status: item.status || "pendente"
  }));

  historico = historico.map((item) => {
    if (typeof item === "string") {
      return { id: cryptoId(), tipo: "movimento", texto: item, data: new Date().toISOString() };
    }
    return { id: item.id || cryptoId(), ...item };
  });

  vendas = vendas.map((venda) => {
    const livro = buscarLivroPorId(venda.livroId);
    const cliente = buscarClientePorId(venda.clienteId);
    return {
      id: venda.id || cryptoId(),
      livroId: venda.livroId || "",
      livroTitulo: venda.livroTitulo || (livro ? livro.titulo : "Livro removido"),
      clienteId: venda.clienteId || "",
      clienteNome: venda.clienteNome || (cliente ? cliente.nome : "Venda sem cliente"),
      quantidade: Number(venda.quantidade || 0),
      total: Number(venda.total || 0),
      data: venda.data || new Date().toISOString()
    };
  });

  salvarDados();
}

function criarDadosExemplo() {
  if (livros.length || clientes.length) return;

  livros = [
    livroExemplo("9789897771001", "A Cidade e as Serras", "Eca de Queiros", "Classicos", 9.9, 4, "Romance"),
    livroExemplo("9789720047289", "Memorial do Convento", "Jose Saramago", "Editorial", 13.5, 2, "Literatura"),
    livroExemplo("9788535914849", "Dom Casmurro", "Machado de Assis", "Companhia", 8.75, 6, "Classico"),
    livroExemplo("9789722328829", "O Principezinho", "Antoine de Saint-Exupery", "Presenca", 7.2, 3, "Infantil")
  ];

  clientes = [
    { id: cryptoId(), nome: "Mariana Costa", telefone: "+351 910 000 111", codigo: "CLI-001", criadoEm: new Date().toISOString() },
    { id: cryptoId(), nome: "Rui Almeida", telefone: "+351 920 000 222", codigo: "CLI-002", criadoEm: new Date().toISOString() }
  ];

  historico = [
    evento("sistema", "Catalogo inicial criado para demonstracao.")
  ];

  salvarDados();
}

function livroExemplo(codigo, titulo, autor, editora, preco, quantidade, categoria) {
  return {
    id: cryptoId(),
    codigo,
    titulo,
    autor,
    editora,
    preco,
    custo: preco,
    margemPercent: 0,
    quantidade,
    recebidos: quantidade,
    categoria,
    capa: capaPorIsbn(codigo),
    vendidos: 0,
    devolvidos: 0,
    origem: livrariaInicial,
    dataAcerto: dataAcertoPadrao(),
    criadoEm: new Date().toISOString()
  };
}

function bindEventos() {
  $("loginForm").addEventListener("submit", fazerLogin);
  $("logoutBtn").addEventListener("click", logout);
  $("formLivro").addEventListener("submit", cadastrarLivro);
  $("formBaixaLivraria").addEventListener("submit", baixarLivroLivraria);
  $("formCliente").addEventListener("submit", cadastrarCliente);
  $("btnCancelarEdicaoLivro").addEventListener("click", cancelarEdicaoLivro);
  $("btnCancelarEdicaoCliente").addEventListener("click", cancelarEdicaoCliente);
  $("formReserva").addEventListener("submit", criarReserva);
  $("btnVender").addEventListener("click", venderLivro);
  $("btnEmprestar").addEventListener("click", emprestarLivro);
  $("btnEscanear").addEventListener("click", abrirScanner);
  $("btnSemCodigo").addEventListener("click", usarLivroSemCodigo);
  $("btnBuscarIsbn").addEventListener("click", preencherLivroPeloCodigo);
  $("btnFocoBusca").addEventListener("click", focarBusca);
  $("btnFocoDevolucao").addEventListener("click", focarDevolucao);
  $("btnVerBaixoEstoque").addEventListener("click", verBaixoEstoque);
  $("btnToggleCaixa").addEventListener("click", toggleCaixa);
  $("btnFecharAcerto").addEventListener("click", fecharAcerto);
  $("reservaCliente").addEventListener("change", preencherTelefoneReserva);
  $("btnClienteRapidoReserva").addEventListener("click", clienteRapido);
  $("precoLivro").addEventListener("input", sugerirRepasse);
  $("origemLivro").addEventListener("input", aplicarPadraoLivraria);
  $("margemLivro").addEventListener("input", () => atualizarRepasseAutomatico(true));
  $("custoLivro").addEventListener("input", () => {
    $("custoLivro").dataset.manual = "true";
  });
  $("btnAbrirCalc").addEventListener("click", abrirCalculadora);
  $("btnFecharCalc").addEventListener("click", fecharCalculadora);
  document.querySelectorAll("[data-calc]").forEach((button) => {
    button.addEventListener("click", () => usarCalculadora(button.dataset.calc));
  });
  $("clienteSaida").addEventListener("change", renderizarFichaCliente);
  $("btnFecharScanner").addEventListener("click", fecharScanner);
  $("codigoLivro").addEventListener("change", preencherLivroPeloCodigo);
  $("codigoLivro").addEventListener("input", agendarBuscaPorCodigo);
  $("codigoLivro").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      preencherLivroPeloCodigo();
    }
  });
  $("fotoCodigo").addEventListener("change", lerCodigoDaFoto);
  $("buscaLivro").addEventListener("input", renderizarBusca);
  $("buscaCliente").addEventListener("input", renderizarBuscaClientes);
  $("filtroEstoque").addEventListener("change", renderizarEstoque);
  $("livroSemana").addEventListener("change", gerarMensagemSemana);
  $("btnGerarMensagemSemana").addEventListener("click", gerarMensagemSemana);
  $("btnWhatsAppProximo").addEventListener("click", abrirWhatsappProximo);
  $("mensagemSemana").addEventListener("input", renderizarWhatsappClientes);
  $("filtroRelatorioPeriodo").addEventListener("change", renderizarRelatorios);
  $("filtroRelatorioTexto").addEventListener("input", renderizarRelatorios);
  $("btnExportar").addEventListener("click", exportarHistorico);

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => ativarTab(button.dataset.tab));
  });
}

function fazerLogin(event) {
  event.preventDefault();
  const nome = $("loginNome").value.trim();
  const senha = $("loginSenha").value.trim();
  const usuario = usuarios.find((item) => item.nome === nome && item.senha === senha);

  if (!usuario) {
    $("erroLogin").textContent = "Usuario ou senha incorretos.";
    return;
  }

  usuarioAtual = usuario;
  $("erroLogin").textContent = "";
  $("usuarioLogado").textContent = usuario.nome;
  $("loginView").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  document.body.classList.toggle("modo-vendedor", usuario.tipo === "vendedor");
  renderizarTudo();
}

function logout() {
  usuarioAtual = null;
  $("workspace").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

function ativarTab(tab) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
}

function cadastrarLivro(event) {
  event.preventDefault();
  const codigo = $("codigoLivro").value.trim();
  const titulo = $("tituloLivro").value.trim();
  const autor = $("autorLivro").value.trim();
  const editora = $("editoraLivro").value.trim();
  const categoria = $("categoriaLivro").value.trim() || "Geral";
  const capa = $("capaLivro").value.trim() || capaPorIsbn(codigo);
  const preco = Number($("precoLivro").value);
  const quantidade = Number($("quantidadeLivro").value);
  const origem = $("origemLivro").value.trim() || livrariaAtual();
  guardarLivrariaAtual(origem);
  const margemPercent = Number($("margemLivro").value || descontoPadraoLivraria(origem) || 0);
  const custo = Number($("custoLivro").value || calcularRepasse(preco, margemPercent));
  const dataAcerto = $("dataAcertoLivro").value || dataAcertoPadrao();

  if (!titulo || !autor || !Number.isFinite(preco) || !Number.isFinite(custo) || !Number.isFinite(margemPercent) || quantidade < 1) {
    avisar("Preencha titulo, autor, preco, repasse e quantidade.");
    return;
  }

  const livroEditando = livroEditandoId ? buscarLivroPorId(livroEditandoId) : null;
  const existente = livroEditando || livros.find((livro) => livro.codigo && codigo && livro.codigo === codigo);
  if (existente) {
    const quantidadeAnterior = Number(existente.quantidade || 0);
    const deltaQuantidade = livroEditando ? quantidade - quantidadeAnterior : quantidade;
    existente.codigo = codigo;
    existente.quantidade = livroEditando ? quantidade : quantidadeAnterior + quantidade;
    existente.recebidos = Math.max(0, Number(existente.recebidos || 0) + deltaQuantidade);
    existente.preco = preco;
    existente.custo = custo;
    existente.margemPercent = margemPercent;
    existente.titulo = titulo;
    existente.autor = autor;
    existente.editora = editora;
    existente.categoria = categoria;
    existente.capa = capa || existente.capa;
    existente.origem = origem;
    existente.dataAcerto = dataAcerto;
    historico.unshift(evento(livroEditando ? "estoque" : "entrada", livroEditando
      ? `Livro editado: ${titulo}`
      : `Entrada consignada: ${quantidade} unidade(s) de ${titulo} - ${origem}`));
  } else {
    livros.unshift({
      id: cryptoId(),
      codigo,
      titulo,
      autor,
      editora,
      categoria,
      capa,
      preco,
      custo,
      margemPercent,
      quantidade,
      recebidos: quantidade,
      vendidos: 0,
      devolvidos: 0,
      origem,
      dataAcerto,
      criadoEm: new Date().toISOString()
    });
    historico.unshift(evento("entrada", `Novo livro consignado: ${titulo} (${quantidade} un.) - ${origem}`));
  }

  event.target.reset();
  $("quantidadeLivro").value = 1;
  $("dataAcertoLivro").value = dataAcertoPadrao();
  $("margemLivro").value = "";
  $("custoLivro").dataset.manual = "";
  renderizarCapa("");
  cancelarEdicaoLivro(false);
  salvarDados();
  renderizarTudo();
  avisar(livroEditando ? "Livro atualizado." : "Estoque atualizado.");
}

async function abrirScanner() {
  if (scannerAtivo || scannerParando) {
    avisar("O scanner ja esta aberto.");
    return;
  }

  if (!window.Html5Qrcode || !window.Html5QrcodeSupportedFormats) {
    avisar("Leitor html5-qrcode nao carregou. Verifique a internet e recarregue.");
    abrirCameraPorFoto();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    abrirCameraPorFoto();
    return;
  }

  try {
    $("scannerModal").classList.remove("hidden");
    $("scannerStatus").textContent = "Abrindo camera traseira...";
    scannerAtivo = true;
    scannerParando = false;

    html5QrCode = new Html5Qrcode("reader");

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 300, height: 160 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      },
      codigoDetectado,
      () => {}
    );

    $("scannerStatus").textContent = "Scanner pronto. Aponte para o ISBN/EAN-13 do livro.";
  } catch (error) {
    await pararScanner();
    avisar("Nao consegui iniciar o leitor. Vou abrir a camera por foto.");
    abrirCameraPorFoto();
  }
}

async function codigoDetectado(decodedText) {
  if (scannerParando) return;
  const codigo = String(decodedText || "").replace(/[^0-9X]/gi, "");
  if (!codigo) return;

  scannerParando = true;
  $("scannerStatus").textContent = `Codigo detectado: ${codigo}`;
  $("codigoLivro").value = codigo;
  atualizarStatusIsbn(`Codigo detectado: ${codigo}. Buscando dados do livro...`);
  avisar(`Codigo detectado: ${codigo}`);

  await pararScanner();
  await preencherLivroPeloCodigo();
}

async function detectarCodigo() {
  const video = $("scannerVideo");
  if (!barcodeDetector || !video.videoWidth) return;

  try {
    const codigos = await barcodeDetector.detect(video);
    if (!codigos.length) return;

    const codigo = codigos[0].rawValue;
    $("codigoLivro").value = codigo;
    preencherLivroPeloCodigo();
    fecharScanner();
    avisar(`Codigo lido: ${codigo}`);
  } catch {
    $("scannerStatus").textContent = "Tentando ler... mantenha o codigo bem iluminado.";
  }
}

async function detectarCodigoComQuagga() {
  const video = $("scannerVideo");
  if (!video.videoWidth || !window.Quagga || scannerBusy) return;
  scannerBusy = true;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imagem = canvas.toDataURL("image/jpeg", 0.85);
    const codigo = await lerCodigoImagemComQuagga(imagem);

    if (!codigo) return;
    $("codigoLivro").value = codigo;
    await preencherLivroPeloCodigo();
    fecharScanner();
    avisar(`Codigo lido: ${codigo}`);
  } catch {
    $("scannerStatus").textContent = "Tentando ler... aproxime, deixe reto e com boa luz.";
  } finally {
    scannerBusy = false;
  }
}

async function detectarCodigoComZxing() {
  const video = $("scannerVideo");
  if (!video.videoWidth || !window.ZXing) return;

  try {
    if (!zxingReader) zxingReader = new ZXing.BrowserMultiFormatReader();
    const resultado = await zxingReader.decodeFromVideoElement(video);
    const codigo = resultado && resultado.text;
    if (!codigo) return;

    $("codigoLivro").value = codigo;
    preencherLivroPeloCodigo();
    fecharScanner();
    avisar(`Codigo lido: ${codigo}`);
  } catch {
    $("scannerStatus").textContent = "Tentando ler... aproxime e mantenha o codigo reto.";
  }
}

async function fecharScanner() {
  await pararScanner();
}

async function pararScanner() {
  if (scannerTimer) {
    window.clearInterval(scannerTimer);
    scannerTimer = null;
  }
  scannerBusy = false;

  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      await html5QrCode.clear();
    } catch {}
    html5QrCode = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  scannerAtivo = false;
  scannerParando = false;
  const html5Reader = $("reader");
  if (html5Reader) html5Reader.innerHTML = "";
  $("scannerModal").classList.add("hidden");
}

function usarLivroSemCodigo() {
  $("codigoLivro").value = `ANTIGO-${Date.now().toString().slice(-6)}`;
  renderizarCapa("");
  $("tituloLivro").focus();
  avisar("Codigo interno criado para livro antigo.");
}

function abrirCameraPorFoto() {
  $("scannerStatus").textContent = "";
  $("fotoCodigo").value = "";
  $("fotoCodigo").click();
  avisar("Abrindo a camera do telemovel para fotografar o codigo.");
}

async function lerCodigoDaFoto(event) {
  const arquivo = event.target.files && event.target.files[0];
  if (!arquivo) return;

  try {
    const codigo = await lerCodigoArquivo(arquivo);
    $("codigoLivro").value = codigo;
    preencherLivroPeloCodigo();
    avisar(`Codigo lido: ${codigo}`);
  } catch {
    avisar("Nao consegui ler esta foto. Aproxime, deixe o codigo reto e tente outra vez.");
  }
}

async function lerCodigoArquivo(arquivo) {
  if (window.Quagga) {
    try {
      return await lerCodigoArquivoComQuagga(arquivo);
    } catch {}
  }

  if (window.ZXing) {
    return lerCodigoArquivoComZxing(arquivo);
  }

  if ("BarcodeDetector" in window) {
    const imagem = await createImageBitmap(arquivo);
    if (!barcodeDetector) {
      barcodeDetector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"]
      });
    }

    const codigos = await barcodeDetector.detect(imagem);
    if (codigos.length) return codigos[0].rawValue;
  }

  throw new Error("Leitor indisponivel");
}

function lerCodigoArquivoComQuagga(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);

    lerCodigoImagemComQuagga(url)
      .then((codigo) => {
        URL.revokeObjectURL(url);
        if (codigo) resolve(codigo);
        else reject(new Error("Codigo nao encontrado"));
      })
      .catch((error) => {
        URL.revokeObjectURL(url);
        reject(error);
      });
  });
}

function lerCodigoImagemComQuagga(src) {
  return new Promise((resolve, reject) => {
    Quagga.decodeSingle(
      {
        src,
        numOfWorkers: 0,
        locate: true,
        inputStream: {
          size: 1600,
          singleChannel: false
        },
        locator: {
          patchSize: "large",
          halfSample: false
        },
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "code_128_reader",
            "code_39_reader"
          ]
        }
      },
      (result) => {
        const codigo = result && result.codeResult && result.codeResult.code;
        if (codigo) resolve(codigo);
        else reject(new Error("Codigo nao encontrado"));
      }
    );
  });
}

function lerCodigoArquivoComZxing(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();

    img.onload = async () => {
      try {
        if (!zxingReader) zxingReader = new ZXing.BrowserMultiFormatReader();
        const resultado = await zxingReader.decodeFromImageElement(img);
        URL.revokeObjectURL(url);
        resolve(resultado.text);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem invalida"));
    };

    img.src = url;
  });
}

function agendarBuscaPorCodigo() {
  window.clearTimeout(buscaCodigoTimer);
  const codigo = limparCodigo($("codigoLivro").value);
  if (codigo.length < 8) return;
  atualizarStatusIsbn("Codigo recebido. Buscando dados...");
  buscaCodigoTimer = window.setTimeout(preencherLivroPeloCodigo, 450);
}

async function preencherLivroPeloCodigo() {
  const codigo = limparCodigo($("codigoLivro").value);
  if (!codigo) return;
  $("codigoLivro").value = codigo;

  const livro = livros.find((item) => item.codigo === codigo);
  if (!livro) {
    atualizarStatusIsbn("Consultando Open Library e Google Books...");
    avisar("Consultando dados do livro pelo ISBN...");
    const dadosOnline = await buscarLivroOnline(codigo);
    if (dadosOnline) {
      preencherFormularioLivro(dadosOnline);
      $("precoLivro").focus();
      atualizarStatusIsbn("Dados preenchidos. Coloque o preco e valide a entrada.");
      avisar("Livro encontrado online. Confira o preco e valide.");
      return;
    }

    limparFormularioLivroNovo(codigo);
    atualizarStatusIsbn("ISBN nao encontrado online. Cadastre manualmente uma vez.");
    avisar("Nao encontrei este ISBN online. Complete os dados uma vez e valide.");
    return;
  }

  preencherFormularioLivro(livro);
  $("quantidadeLivro").value = 1;
  $("quantidadeLivro").focus();
  atualizarStatusIsbn("Livro ja existe no estoque. Confirme a quantidade.");
  avisar("Livro encontrado. Confirme a quantidade para adicionar ao estoque.");
}

function preencherFormularioLivro(livro) {
  $("codigoLivro").value = livro.codigo || $("codigoLivro").value.trim();
  $("tituloLivro").value = livro.titulo || "";
  $("autorLivro").value = livro.autor || "";
  $("editoraLivro").value = livro.editora || "";
  $("categoriaLivro").value = livro.categoria || "Geral";
  $("precoLivro").value = livro.preco || "";
  $("custoLivro").value = livro.custo || livro.preco || "";
  $("custoLivro").dataset.manual = livro.custo ? "true" : "";
  $("margemLivro").value = Number.isFinite(Number(livro.margemPercent)) ? Number(livro.margemPercent) : descontoPadraoLivraria(livro.origem);
  $("origemLivro").value = livro.origem || $("origemLivro").value || livrariaAtual();
  $("dataAcertoLivro").value = livro.dataAcerto || $("dataAcertoLivro").value || dataAcertoPadrao();
  $("capaLivro").value = livro.capa || "";
  renderizarCapa(livro.capa || "");
}

function limparFormularioLivroNovo(codigo) {
  const origem = $("origemLivro").value || livrariaAtual();
  $("codigoLivro").value = codigo;
  $("tituloLivro").value = "";
  $("autorLivro").value = "";
  $("editoraLivro").value = "";
  $("categoriaLivro").value = "";
  $("precoLivro").value = "";
  $("custoLivro").value = "";
  $("origemLivro").value = origem;
  $("margemLivro").value = descontoPadraoLivraria(origem) || "";
  $("dataAcertoLivro").value = $("dataAcertoLivro").value || dataAcertoPadrao();
  $("capaLivro").value = capaPorIsbn(codigo);
  renderizarCapa(capaPorIsbn(codigo));
  $("tituloLivro").focus();
}

async function buscarLivroOnline(codigoOriginal) {
  const codigo = limparCodigo(codigoOriginal);
  if (!codigo || codigo.startsWith("ANTIGO-")) return null;

  const resultados = await Promise.all([
    buscarOpenLibrary(codigo),
    buscarGoogleBooks(codigo)
  ]);
  const openLibrary = resultados[0];
  const googleBooks = resultados[1];

  if (openLibrary || googleBooks) {
    const principal = openLibrary || googleBooks;
    const apoio = googleBooks || openLibrary;
    return {
      codigo,
      titulo: principal.titulo || apoio.titulo || "",
      autor: principal.autor || apoio.autor || "",
      editora: principal.editora || apoio.editora || "",
      categoria: principal.categoria || apoio.categoria || "Geral",
      preco: "",
      capa: openLibrary && openLibrary.capa ? openLibrary.capa : (googleBooks && googleBooks.capa ? googleBooks.capa : capaPorIsbn(codigo))
    };
  }

  return null;
}

async function buscarOpenLibrary(codigo) {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(codigo)}&format=json&jscmd=data`;
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const json = await resposta.json();
    const item = json[`ISBN:${codigo}`];
    if (!item || !item.title) return null;
    const primeiroAssunto = item.subjects && item.subjects[0];
    const capa = item.cover || {};

    return {
      codigo,
      titulo: item.title || "",
      autor: (item.authors || []).map((autor) => autor.name).join(", "),
      editora: (item.publishers || []).map((editora) => editora.name).join(", "),
      categoria: (primeiroAssunto && primeiroAssunto.name) || "Geral",
      preco: "",
      capa: capa.large || capa.medium || capa.small || ""
    };
  } catch {
    return null;
  }
}

async function buscarGoogleBooks(codigo) {
  try {
    const resposta = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(codigo)}`);
    if (!resposta.ok) return null;
    const json = await resposta.json();
    const primeiroItem = json.items && json.items[0];
    const info = primeiroItem && primeiroItem.volumeInfo;
    if (!info || !info.title) return null;
    const imagens = info.imageLinks || {};
    const capa = imagens.thumbnail ? imagens.thumbnail.replace("http://", "https://") : "";

    return {
      codigo,
      titulo: info.title || "",
      autor: (info.authors || []).join(", "),
      editora: info.publisher || "",
      categoria: (info.categories || [])[0] || "Geral",
      preco: "",
      capa: capa || ""
    };
  } catch {
    return null;
  }
}

function renderizarCapa(url) {
  $("capaPreview").innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="Capa do livro" onerror="this.parentNode.innerHTML='<span>Capa nao encontrada</span>'">`
    : "<span>Capa</span>";
}

function atualizarStatusIsbn(texto) {
  const status = $("statusIsbn");
  if (status) status.textContent = texto;
}

function cadastrarCliente(event) {
  event.preventDefault();
  const nome = $("nomeCliente").value.trim();
  const telefone = $("telefoneCliente").value.trim();
  const codigo = $("codigoCliente").value.trim();

  if (!nome || !telefone) {
    avisar("Preencha nome e telefone do cliente.");
    return;
  }

  const clienteEditando = clienteEditandoId ? buscarClientePorId(clienteEditandoId) : null;
  const existente = clienteEditando || clientes.find((cliente) => normalizar(cliente.nome) === normalizar(nome));
  if (existente) {
    const nomeAnterior = existente.nome;
    existente.nome = nome;
    existente.telefone = telefone;
    existente.codigo = codigo || existente.codigo;
    vendas.forEach((venda) => {
      if (venda.clienteId === existente.id) venda.clienteNome = nome;
    });
    reservas.forEach((reserva) => {
      if (normalizar(reserva.clienteNome) === normalizar(nomeAnterior)) {
        reserva.clienteNome = nome;
        reserva.telefone = telefone;
      }
    });
    historico.unshift(evento("cliente", `Cliente atualizado: ${nome}`));
  } else {
    clientes.unshift({ id: cryptoId(), nome, telefone, codigo, criadoEm: new Date().toISOString() });
    historico.unshift(evento("cliente", `Cliente cadastrado: ${nome}`));
  }

  event.target.reset();
  cancelarEdicaoCliente(false);
  salvarDados();
  renderizarTudo();
  avisar(clienteEditando ? "Cliente atualizado." : "Cliente salvo.");
}

function venderLivro() {
  const livro = buscarLivroPorId($("livroSaida").value);
  const cliente = buscarClientePorId($("clienteSaida").value);
  const quantidade = Number($("quantidadeSaida").value || 1);

  if (!livro || livro.quantidade < quantidade || quantidade < 1) {
    avisar("Livro indisponivel na quantidade desejada.");
    return;
  }

  livro.quantidade -= quantidade;
  livro.vendidos += quantidade;
  const total = livro.preco * quantidade;
  caixa += total;
  vendas.unshift({
    id: cryptoId(),
    livroId: livro.id,
    livroTitulo: livro.titulo,
    clienteId: cliente ? cliente.id : "",
    clienteNome: cliente ? cliente.nome : "Venda sem cliente",
    quantidade,
    total,
    data: new Date().toISOString()
  });
  historico.unshift(evento("venda", `Venda: ${quantidade}x ${livro.titulo} por ${formatarMoeda(total)}${cliente ? ` para ${cliente.nome}` : ""}`));

  salvarDados();
  renderizarTudo();
  avisar("Venda registrada.");
}

function emprestarLivro() {
  const livro = buscarLivroPorId($("livroSaida").value);
  const cliente = buscarClientePorId($("clienteSaida").value);

  if (!cliente) {
    avisar("Selecione um cliente cadastrado antes de emprestar.");
    renderizarFichaCliente();
    return;
  }

  const pendentes = emprestimosDoCliente(cliente.id);
  if (pendentes.length) {
    const ok = confirm(`${cliente.nome} tem ${pendentes.length} livro(s) pendente(s). Deseja emprestar outro mesmo assim?`);
    if (!ok) {
      focarDevolucao();
      return;
    }
  }

  if (!livro || livro.quantidade < 1) {
    avisar("Selecione um livro disponivel.");
    return;
  }

  livro.quantidade -= 1;
  emprestimos.unshift({
    id: cryptoId(),
    livroId: livro.id,
    clienteId: cliente.id,
    data: new Date().toISOString(),
    status: "ativo"
  });
  historico.unshift(evento("emprestimo", `Emprestimo: ${livro.titulo} para ${cliente.nome}`));

  salvarDados();
  renderizarTudo();
  avisar("Emprestimo registrado.");
}

function devolverEmprestimo(id) {
  const emprestimo = emprestimos.find((item) => item.id === id && item.status === "ativo");
  if (!emprestimo) {
    avisar("Emprestimo nao encontrado.");
    return;
  }

  const livro = buscarLivroPorId(emprestimo.livroId);
  const cliente = buscarClientePorId(emprestimo.clienteId);
  emprestimo.status = "devolvido";
  emprestimo.devolvidoEm = new Date().toISOString();
  if (livro) livro.quantidade += 1;
  historico.unshift(evento("devolucao", `Devolucao: ${livro ? livro.titulo : "Livro"} de ${cliente ? cliente.nome : "cliente"}`));

  salvarDados();
  renderizarTudo();
  avisar("Livro devolvido ao estoque.");
}

function criarReserva(event) {
  event.preventDefault();
  const cliente = buscarClientePorId($("reservaCliente").value);
  const clienteNome = cliente ? cliente.nome : "";
  const telefone = cliente ? cliente.telefone || "" : "";
  const livro = buscarLivroPorId($("reservaLivro").value);

  if (!cliente || !livro) {
    avisar("Informe cliente e livro para reservar.");
    return;
  }

  reservas.unshift({
    id: cryptoId(),
    clienteNome,
    telefone,
    livroId: livro.id,
    data: new Date().toISOString(),
    status: "pendente"
  });
  historico.unshift(evento("reserva", `Reserva online: ${livro.titulo} para ${clienteNome}`));

  event.target.reset();
  preencherTelefoneReserva();
  salvarDados();
  renderizarTudo();
  avisar("Reserva criada.");
}

function concluirReserva(id) {
  const reserva = reservas.find((item) => item.id === id);
  const livro = buscarLivroPorId(reserva ? reserva.livroId : "");
  if (!reserva || !livro) return;

  if (livro.quantidade < 1) {
    avisar("Sem estoque para concluir esta reserva.");
    return;
  }

  livro.quantidade -= 1;
  livro.vendidos += 1;
  caixa += livro.preco;
  reserva.status = "concluida";
  vendas.unshift({
    id: cryptoId(),
    livroId: livro.id,
    livroTitulo: livro.titulo,
    clienteId: "",
    clienteNome: reserva.clienteNome || "Reserva",
    quantidade: 1,
    total: livro.preco,
    data: new Date().toISOString()
  });
  historico.unshift(evento("venda", `Reserva concluida: ${livro.titulo} para ${reserva.clienteNome}`));
  salvarDados();
  renderizarTudo();
  avisar("Reserva convertida em venda.");
}

function cancelarReserva(id) {
  const reserva = reservas.find((item) => item.id === id);
  if (!reserva) return;
  reserva.status = "cancelada";
  historico.unshift(evento("reserva", `Reserva cancelada: ${reserva.clienteNome}`));
  salvarDados();
  renderizarTudo();
  avisar("Reserva cancelada.");
}

function baixarLivroLivraria(event) {
  event.preventDefault();
  const livro = buscarLivroPorId($("livroBaixa").value);
  const quantidade = Number($("quantidadeBaixa").value || 1);

  if (!livro || quantidade < 1) {
    avisar("Selecione um livro e quantidade para baixa.");
    return;
  }

  if (livro.quantidade < quantidade) {
    avisar("Nao ha esta quantidade disponivel para devolver.");
    return;
  }

  livro.quantidade -= quantidade;
  livro.devolvidos = Number(livro.devolvidos || 0) + quantidade;
  historico.unshift(evento("baixa", `Baixa para livraria: ${quantidade}x ${livro.titulo} - ${livro.origem || livrariaInicial}`));

  $("quantidadeBaixa").value = 1;
  salvarDados();
  renderizarTudo();
  avisar("Baixa registrada para devolucao a livraria.");
}

function ajustarEstoque(id, delta) {
  const livro = buscarLivroPorId(id);
  if (!livro) return;
  livro.quantidade = Math.max(0, livro.quantidade + delta);
  historico.unshift(evento("estoque", `Ajuste de estoque: ${livro.titulo} (${delta > 0 ? "+" : ""}${delta})`));
  salvarDados();
  renderizarTudo();
}

function renderizarTudo() {
  renderizarMetricas();
  renderizarSelects();
  renderizarDatalists();
  renderizarFichaCliente();
  renderizarBusca();
  renderizarBuscaClientes();
  renderizarEstoque();
  renderizarAcerto();
  renderizarAcertosFechados();
  renderizarEmprestimos();
  renderizarReservas();
  renderizarClientes();
  renderizarWhatsapp();
  renderizarRelatorios();
  renderizarHistorico();
}

function renderizarMetricas() {
  const emprestimosAtivos = emprestimos.filter((item) => item.status === "ativo").length;
  const baixoEstoque = livros.filter((livro) => livro.quantidade > 0 && livro.quantidade <= 2).length;
  $("caixaTotal").textContent = caixaVisivel ? formatarMoeda(caixa) : "****";
  $("btnToggleCaixa").textContent = caixaVisivel ? "Ocultar" : "Ver";
  $("totalEstoque").textContent = livros.reduce((soma, livro) => soma + livro.quantidade, 0);
  $("totalVendido").textContent = livros.reduce((soma, livro) => soma + livro.vendidos, 0);
  $("totalReservas").textContent = reservas.filter((item) => item.status === "pendente").length;
  $("totalPagarLivraria").textContent = caixaVisivel ? formatarMoeda(totalAPagarLivraria()) : "****";
  $("totalEmprestimos").textContent = emprestimosAtivos;
  $("totalBaixoEstoque").textContent = baixoEstoque;
}

function toggleCaixa() {
  caixaVisivel = !caixaVisivel;
  localStorage.setItem("caixaVisivel", String(caixaVisivel));
  renderizarMetricas();
}

function abrirCalculadora() {
  $("calcDrawer").classList.remove("hidden");
}

function fecharCalculadora() {
  $("calcDrawer").classList.add("hidden");
}

function usarCalculadora(tecla) {
  if (tecla === "C") {
    calcValor = "0";
  } else if (tecla === "back") {
    calcValor = calcValor.length > 1 ? calcValor.slice(0, -1) : "0";
  } else if (tecla === "=") {
    calcularExpressao();
  } else {
    calcValor = calcValor === "0" ? tecla : calcValor + tecla;
  }

  $("calcDisplay").value = calcValor;
}

function calcularExpressao() {
  if (!/^[0-9+\-*/. ]+$/.test(calcValor)) {
    calcValor = "Erro";
    return;
  }

  try {
    const resultado = Function(`"use strict"; return (${calcValor})`)();
    calcValor = Number.isFinite(resultado) ? String(Math.round(resultado * 100) / 100) : "Erro";
  } catch {
    calcValor = "Erro";
  }
}

function renderizarSelects() {
  const livrosDisponiveis = livros.filter((livro) => livro.quantidade > 0);
  preencherSelect($("livroSaida"), livrosDisponiveis, (livro) => `${livro.titulo} - ${livro.quantidade} un.`);
  preencherSelect($("livroBaixa"), livrosDisponiveis, (livro) => `${livro.titulo} - ${livro.quantidade} un.`);
  preencherSelect($("reservaLivro"), livros, (livro) => `${livro.titulo} - ${livro.quantidade} un.`);
  preencherSelect($("livroSemana"), livros, (livro) => `${livro.titulo} - ${formatarMoeda(livro.preco)}`, "Selecione o livro da semana");
  preencherSelect($("clienteSaida"), clientes, (cliente) => cliente.nome, "Selecione um cliente");
  preencherSelect($("reservaCliente"), clientes, (cliente) => cliente.nome, "Selecione um cliente");
  preencherTelefoneReserva();
}

function preencherSelect(select, itens, label, vazio = "Selecione") {
  const valorAtual = select.value;
  select.innerHTML = "";
  if (!itens.length) {
    select.innerHTML = `<option value="">${vazio}</option>`;
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = vazio;
  select.appendChild(placeholder);

  itens.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = label(item);
    select.appendChild(option);
  });

  if (valorAtual && itens.some((item) => item.id === valorAtual)) {
    select.value = valorAtual;
  }
}

function renderizarBusca() {
  const campoBusca = $("buscaLivro");
  const termo = normalizar(campoBusca ? campoBusca.value : "");
  const encontrados = livros.filter((livro) => {
    const texto = normalizar(`${livro.codigo} ${livro.titulo} ${livro.autor} ${livro.editora} ${livro.categoria}`);
    return !termo || texto.includes(termo);
  });

  $("searchCount").textContent = `${encontrados.length} resultado${encontrados.length === 1 ? "" : "s"}`;
  $("resultadoBusca").innerHTML = encontrados.length
    ? encontrados.map(cardLivro).join("")
    : `<div class="empty-state">Nenhum livro encontrado.</div>`;
}

function renderizarBuscaClientes() {
  const campoBusca = $("buscaCliente");
  const termo = normalizar(campoBusca ? campoBusca.value : "");
  const encontrados = clientes.filter((cliente) => {
    const texto = normalizar(`${cliente.nome} ${cliente.telefone} ${cliente.codigo}`);
    return !termo || texto.includes(termo);
  }).slice(0, 8);

  $("clientSearchCount").textContent = `${encontrados.length} resultado${encontrados.length === 1 ? "" : "s"}`;
  $("resultadoClientes").innerHTML = encontrados.length
    ? encontrados.map(cardClienteBusca).join("")
    : `<div class="empty-state">Nenhum cliente encontrado.</div>`;
}

function renderizarFichaCliente() {
  const painel = $("fichaCliente");
  if (!painel) return;

  const cliente = buscarClientePorId($("clienteSaida").value);
  if (!cliente) {
    painel.className = "client-profile";
    painel.innerHTML = `<strong>Selecione um cliente</strong><span>A ficha aparece aqui antes de emprestar.</span>`;
    return;
  }

  const pendentes = emprestimosDoCliente(cliente.id);
  const compras = vendas.filter((venda) => venda.clienteId === cliente.id);
  const reservasCliente = reservas.filter((reserva) => reserva.status === "pendente" && normalizar(reserva.clienteNome) === normalizar(cliente.nome));
  const classe = pendentes.length ? "client-profile warning" : "client-profile ok";

  painel.className = classe;
  painel.innerHTML = `
    <div>
      <strong>${escapeHtml(cliente.nome)}</strong>
      <span>${escapeHtml(cliente.telefone || "Sem telefone")} ${cliente.codigo ? `- ${escapeHtml(cliente.codigo)}` : ""}</span>
    </div>
    <div class="profile-stats">
      <span>${pendentes.length} pendente(s)</span>
      <span>${compras.length} compra(s)</span>
      <span>${reservasCliente.length} reserva(s)</span>
    </div>
    ${pendentes.length ? `<div class="profile-alert">Atencao: cliente tem livro por devolver antes de novo emprestimo.</div>` : `<div class="profile-ok">Cliente sem pendencias de emprestimo.</div>`}
  `;
}

function preencherTelefoneReserva() {
  const cliente = buscarClientePorId($("reservaCliente").value);
  $("reservaTelefone").value = cliente ? cliente.telefone || "" : "";
}

function renderizarDatalists() {
  const origens = Array.from(new Set([
    ...livrariasPadrao.map((livraria) => livraria.nome),
    ...livros.map((livro) => livro.origem).filter(Boolean)
  ]));
  $("listaLivrarias").innerHTML = origens.map((origem) => `<option value="${escapeHtml(origem)}"></option>`).join("");
}

function sugerirRepasse() {
  atualizarRepasseAutomatico(false);
}

function aplicarPadraoLivraria() {
  const origem = $("origemLivro").value.trim() || livrariaAtual();
  $("origemLivro").value = origem;
  guardarLivrariaAtual(origem);
  const margem = descontoPadraoLivraria(origem);
  if (Number.isFinite(margem)) {
    $("margemLivro").value = margem;
    atualizarRepasseAutomatico(true);
  }
}

function atualizarRepasseAutomatico(forcar) {
  const preco = Number($("precoLivro").value);
  const margem = Number($("margemLivro").value || descontoPadraoLivraria($("origemLivro").value || livrariaAtual()) || 0);
  const custoManual = $("custoLivro").dataset.manual === "true";

  if (!Number.isFinite(preco) || preco <= 0 || !Number.isFinite(margem)) return;
  if (!forcar && custoManual) return;

  $("margemLivro").value = margem;
  $("custoLivro").value = calcularRepasse(preco, margem).toFixed(2);
  $("custoLivro").dataset.manual = "";
}

function clienteRapido() {
  const nome = prompt("Nome do cliente:");
  if (!nome) return;
  const telefone = prompt("Telefone/WhatsApp:", "") || "";
  const existente = clientes.find((cliente) => normalizar(cliente.nome) === normalizar(nome));
  const cliente = existente || { id: cryptoId(), nome: nome.trim(), telefone: telefone.trim(), codigo: "", criadoEm: new Date().toISOString() };

  if (existente) {
    if (telefone.trim()) existente.telefone = telefone.trim();
  } else {
    clientes.unshift(cliente);
    historico.unshift(evento("cliente", `Cliente rapido cadastrado: ${cliente.nome}`));
  }

  salvarDados();
  renderizarTudo();
  $("clienteSaida").value = cliente.id;
  $("reservaCliente").value = cliente.id;
  renderizarFichaCliente();
  preencherTelefoneReserva();
  avisar("Cliente selecionado.");
}

function renderizarEmprestimos() {
  const ativos = emprestimos.filter((item) => item.status === "ativo");
  $("listaEmprestimos").innerHTML = ativos.length
    ? ativos.map(cardEmprestimo).join("")
    : `<div class="empty-state">Nenhum livro emprestado no momento.</div>`;
}

function renderizarEstoque() {
  const campoFiltro = $("filtroEstoque");
  const filtro = campoFiltro ? campoFiltro.value : "todos";
  let lista = [...livros];

  if (filtro === "baixo") lista = lista.filter((livro) => livro.quantidade > 0 && livro.quantidade <= 2);
  if (filtro === "zerado") lista = lista.filter((livro) => livro.quantidade === 0);
  if (filtro === "reservado") {
    const reservados = new Set(reservas.filter((item) => item.status === "pendente").map((item) => item.livroId));
    lista = lista.filter((livro) => reservados.has(livro.id));
  }

  $("listaEstoque").innerHTML = lista.length
    ? `<div class="inventory-row header"><span>Livro</span><span>Preco</span><span>Estoque</span><span>Vendido</span><span>Reservas</span><span>Ajuste</span></div>${lista.map(linhaEstoque).join("")}`
    : `<div class="empty-state">Nao ha itens para este filtro.</div>`;
}

function renderizarAcerto() {
  const lista = livros.filter((livro) => Number(livro.recebidos || 0) > 0 || Number(livro.vendidos || 0) > 0 || Number(livro.devolvidos || 0) > 0);
  const vendidos = lista.reduce((soma, livro) => soma + Number(livro.vendidos || 0), 0);
  const devolvidos = lista.reduce((soma, livro) => soma + Number(livro.devolvidos || 0), 0);
  const estoque = lista.reduce((soma, livro) => soma + Number(livro.quantidade || 0), 0);
  const pagar = totalAPagarLivraria();
  const lucro = totalLucroLivraria();

  $("resumoAcerto").textContent = `${lista.length} itens`;
  $("resumoConsignacao").innerHTML = `
    <article><span>Vendido a pagar</span><strong>${caixaVisivel ? formatarMoeda(pagar) : "****"}</strong></article>
    <article><span>Ganho da igreja</span><strong>${caixaVisivel ? formatarMoeda(lucro) : "****"}</strong></article>
    <article><span>Unidades vendidas</span><strong>${vendidos}</strong></article>
    <article><span>A devolver</span><strong>${estoque}</strong></article>
    <article><span>Ja baixadas</span><strong>${devolvidos}</strong></article>
  `;

  $("listaAcerto").innerHTML = lista.length
    ? `${resumoLivrariasAcerto(lista)}<div class="settlement-row header"><span>Livro</span><span>Livraria</span><span>Vendidos</span><span>Estoque</span><span>Ganho</span><span>A pagar</span><span>Acerto</span></div>${lista.map(linhaAcerto).join("")}`
    : `<div class="empty-state">Ainda nao ha livros consignados para acerto.</div>`;
}

function renderizarAcertosFechados() {
  $("listaAcertosFechados").innerHTML = acertos.length
    ? acertos.slice(0, 12).map((acerto) => `
      <article class="history-item">
        <strong>${formatarDataCurta(acerto.data)} - ${formatarMoeda(acerto.totalPagar)} pagos/pendentes</strong>
        <span class="history-meta">${acerto.vendidos} vendido(s), ${acerto.devolvidos} devolvido(s), ${acerto.itens.length} titulo(s)</span>
      </article>
    `).join("")
    : `<div class="empty-state">Nenhum acerto fechado ainda.</div>`;
}

function fecharAcerto() {
  const itens = livros.filter((livro) => Number(livro.vendidos || 0) > 0 || Number(livro.devolvidos || 0) > 0);
  if (!itens.length) {
    avisar("Nao ha vendas ou baixas para fechar.");
    return;
  }

  const totalPagar = itens.reduce((soma, livro) => soma + valorPagarLivro(livro), 0);
  const vendidos = itens.reduce((soma, livro) => soma + Number(livro.vendidos || 0), 0);
  const devolvidos = itens.reduce((soma, livro) => soma + Number(livro.devolvidos || 0), 0);
  const continuar = confirm(`Fechar acerto?\n\nA pagar: ${formatarMoeda(totalPagar)}\nVendidos: ${vendidos}\nDevolvidos/baixados: ${devolvidos}\n\nOs livros que ficaram em estoque continuam para o proximo ciclo.`);
  if (!continuar) return;

  const acerto = {
    id: cryptoId(),
    data: new Date().toISOString(),
    totalPagar,
    vendidos,
    devolvidos,
    itens: itens.map((livro) => ({
      codigo: livro.codigo,
      titulo: livro.titulo,
      origem: livro.origem,
      custo: Number(livro.custo || livro.preco || 0),
      preco: Number(livro.preco || 0),
      vendidos: Number(livro.vendidos || 0),
      devolvidos: Number(livro.devolvidos || 0),
      estoqueMantido: Number(livro.quantidade || 0),
      margemPercent: margemPorLivro(livro),
      pagar: valorPagarLivro(livro),
      lucro: lucroLivro(livro)
    }))
  };

  acertos.unshift(acerto);
  livros.forEach((livro) => {
    livro.recebidos = Number(livro.quantidade || 0);
    livro.vendidos = 0;
    livro.devolvidos = 0;
    livro.dataAcerto = dataAcertoPadrao();
  });

  historico.unshift(evento("acerto", `Acerto fechado: ${formatarMoeda(totalPagar)} para pagar, ${vendidos} vendido(s), ${devolvidos} devolvido(s).`));
  salvarDados();
  renderizarTudo();
  avisar("Acerto fechado e arquivado.");
}

function renderizarReservas() {
  const pendentes = reservas.filter((item) => item.status === "pendente");
  $("listaReservas").innerHTML = pendentes.length
    ? pendentes.map(cardReserva).join("")
    : `<div class="empty-state">Sem reservas pendentes.</div>`;
}

function renderizarClientes() {
  $("listaClientes").innerHTML = clientes.length
    ? clientes.map((cliente) => {
        const compras = vendas.filter((venda) => venda.clienteId === cliente.id).length;
        const emprestados = emprestimos.filter((item) => item.clienteId === cliente.id && item.status === "ativo").length;
        return `
          <article class="client-card">
            <div>
              <p class="book-title">${escapeHtml(cliente.nome)}</p>
              <p class="book-meta">${escapeHtml(cliente.telefone || "Sem telefone")} ${cliente.codigo ? `- ${escapeHtml(cliente.codigo)}` : ""}</p>
            </div>
            <div class="client-card-actions">
              <span class="status-pill">${compras} compra(s) / ${emprestados} emprestimo(s)</span>
              <button type="button" class="tiny-action" onclick="editarCliente('${cliente.id}')">Editar</button>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="empty-state">Nenhum cliente cadastrado.</div>`;
}

function renderizarWhatsapp() {
  if (!$("livroSemana").value && livros.length) {
    $("livroSemana").value = livros[0].id;
  }
  if (!$("mensagemSemana").value.trim()) {
    gerarMensagemSemana();
  }
  renderizarWhatsappClientes();
}

function gerarMensagemSemana() {
  const livro = buscarLivroPorId($("livroSemana").value);
  if (!livro) {
    $("mensagemSemana").value = "";
    renderizarWhatsappClientes();
    return;
  }

  $("mensagemSemana").value = [
    "Ola {cliente}!",
    "",
    `O livro da semana na Biblioteca Livraria e "${livro.titulo}".`,
    `Autor: ${livro.autor || "Autor desconhecido"}`,
    `Preco: ${formatarMoeda(livro.preco)}`,
    "",
    "Se quiser reservar, responda a esta mensagem."
  ].join("\n");
  whatsappIndice = 0;
  renderizarWhatsappClientes();
}

function renderizarWhatsappClientes() {
  const clientesComTelefone = clientes.filter((cliente) => telefoneWhatsapp(cliente.telefone));
  $("totalClientesWhatsapp").textContent = `${clientesComTelefone.length} cliente${clientesComTelefone.length === 1 ? "" : "s"}`;
  $("statusWhatsapp").textContent = clientesComTelefone.length
    ? "O WhatsApp abre com a mensagem pronta. Confirme o envio dentro do WhatsApp."
    : "Cadastre telefone com indicativo do pais para enviar pelo WhatsApp.";

  $("listaWhatsappClientes").innerHTML = clientesComTelefone.length
    ? clientesComTelefone.map(cardWhatsappCliente).join("")
    : `<div class="empty-state">Nenhum cliente com telefone valido para WhatsApp.</div>`;
}

function cardWhatsappCliente(cliente) {
  const url = linkWhatsappCliente(cliente);
  return `
    <article class="whatsapp-card">
      <div>
        <p class="book-title">${escapeHtml(cliente.nome)}</p>
        <p class="book-meta">${escapeHtml(cliente.telefone || "Sem telefone")}</p>
      </div>
      <a class="whatsapp-action" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
    </article>
  `;
}

function abrirWhatsappProximo() {
  const clientesComTelefone = clientes.filter((cliente) => telefoneWhatsapp(cliente.telefone));
  if (!clientesComTelefone.length) {
    avisar("Nenhum cliente com telefone valido.");
    return;
  }

  if (whatsappIndice >= clientesComTelefone.length) whatsappIndice = 0;
  const cliente = clientesComTelefone[whatsappIndice];
  whatsappIndice += 1;
  window.open(linkWhatsappCliente(cliente), "_blank", "noopener");
  avisar(`WhatsApp aberto para ${cliente.nome}.`);
}

function linkWhatsappCliente(cliente) {
  const telefone = telefoneWhatsapp(cliente.telefone);
  const mensagem = mensagemWhatsappCliente(cliente);
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

function mensagemWhatsappCliente(cliente) {
  const texto = $("mensagemSemana").value.trim() || "Ola {cliente}!";
  return texto.replace(/\{cliente\}/gi, cliente.nome);
}

function telefoneWhatsapp(telefone) {
  let digitos = String(telefone || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 9 && digitos.startsWith("9")) digitos = `351${digitos}`;
  if (digitos.length === 9 && /^[67]/.test(digitos)) digitos = `34${digitos}`;
  return digitos.length >= 10 ? digitos : "";
}

function renderizarRelatorios() {
  const vendasFiltradas = vendasDoRelatorio();
  const totalUnidades = vendasFiltradas.reduce((soma, venda) => soma + Number(venda.quantidade || 0), 0);
  const totalReceita = vendasFiltradas.reduce((soma, venda) => soma + Number(venda.total || 0), 0);
  const ticketMedio = vendasFiltradas.length ? totalReceita / vendasFiltradas.length : 0;
  const livrosRanking = rankingLivrosVendidos(vendasFiltradas);
  const clientesRanking = rankingClientesCompradores(vendasFiltradas);
  const livroTop = livrosRanking[0];
  const clienteTop = clientesRanking[0];

  $("resumoRelatorio").innerHTML = `
    <article>
      <span>Livro mais vendido</span>
      <strong>${livroTop ? escapeHtml(livroTop.nome) : "-"}</strong>
      <small>${livroTop ? `${livroTop.quantidade} un. / ${formatarMoeda(livroTop.total)}` : "Sem vendas no filtro"}</small>
    </article>
    <article>
      <span>Cliente que compra mais</span>
      <strong>${clienteTop ? escapeHtml(clienteTop.nome) : "-"}</strong>
      <small>${clienteTop ? `${clienteTop.quantidade} un. / ${formatarMoeda(clienteTop.total)}` : "Sem cliente no filtro"}</small>
    </article>
    <article>
      <span>Faturacao</span>
      <strong>${formatarMoeda(totalReceita)}</strong>
      <small>${totalUnidades} unidade(s) vendida(s)</small>
    </article>
    <article>
      <span>Ticket medio</span>
      <strong>${formatarMoeda(ticketMedio)}</strong>
      <small>${vendasFiltradas.length} venda(s)</small>
    </article>
  `;

  $("rankingLivros").innerHTML = livrosRanking.length
    ? livrosRanking.slice(0, 10).map((item, index) => cardRanking(item, index, "livro")).join("")
    : `<div class="empty-state">Sem vendas de livros para este filtro.</div>`;

  $("rankingClientes").innerHTML = clientesRanking.length
    ? clientesRanking.slice(0, 10).map((item, index) => cardRanking(item, index, "cliente")).join("")
    : `<div class="empty-state">Sem clientes com compras neste filtro.</div>`;
}

function vendasDoRelatorio() {
  const periodo = $("filtroRelatorioPeriodo") ? $("filtroRelatorioPeriodo").value : "todos";
  const termo = normalizar($("filtroRelatorioTexto") ? $("filtroRelatorioTexto").value : "");
  const inicio = dataInicioRelatorio(periodo);

  return vendas.filter((venda) => {
    const dataVenda = new Date(venda.data);
    if (inicio && dataVenda < inicio) return false;

    const livro = buscarLivroPorId(venda.livroId);
    const cliente = buscarClientePorId(venda.clienteId);
    const texto = normalizar(`${venda.livroTitulo || ""} ${livro ? livro.titulo : ""} ${venda.clienteNome || ""} ${cliente ? cliente.nome : ""}`);
    return !termo || texto.includes(termo);
  });
}

function dataInicioRelatorio(periodo) {
  const agora = new Date();
  if (periodo === "todos") return null;
  if (periodo === "hoje") return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === "mes") return new Date(agora.getFullYear(), agora.getMonth(), 1);
  const dias = Number(periodo);
  if (Number.isFinite(dias)) {
    const data = new Date(agora);
    data.setDate(data.getDate() - dias);
    return data;
  }
  return null;
}

function rankingLivrosVendidos(listaVendas) {
  const mapa = new Map();
  listaVendas.forEach((venda) => {
    const livro = buscarLivroPorId(venda.livroId);
    const chave = venda.livroId || venda.livroTitulo || "sem-livro";
    const atual = mapa.get(chave) || {
      nome: livro ? livro.titulo : (venda.livroTitulo || "Livro removido"),
      detalhe: livro ? `${livro.autor || "Autor desconhecido"} - ${livro.categoria || "Geral"}` : "Livro removido do estoque",
      quantidade: 0,
      total: 0
    };
    atual.quantidade += Number(venda.quantidade || 0);
    atual.total += Number(venda.total || 0);
    mapa.set(chave, atual);
  });
  return ordenarRanking(Array.from(mapa.values()));
}

function rankingClientesCompradores(listaVendas) {
  const mapa = new Map();
  listaVendas.forEach((venda) => {
    const cliente = buscarClientePorId(venda.clienteId);
    const nome = cliente ? cliente.nome : (venda.clienteNome || "Venda sem cliente");
    const chave = venda.clienteId || nome;
    const atual = mapa.get(chave) || {
      nome,
      detalhe: cliente ? (cliente.telefone || "Sem telefone") : "Sem cadastro vinculado",
      quantidade: 0,
      total: 0
    };
    atual.quantidade += Number(venda.quantidade || 0);
    atual.total += Number(venda.total || 0);
    mapa.set(chave, atual);
  });
  return ordenarRanking(Array.from(mapa.values()));
}

function ordenarRanking(lista) {
  return lista.sort((a, b) => {
    if (b.quantidade !== a.quantidade) return b.quantidade - a.quantidade;
    return b.total - a.total;
  });
}

function cardRanking(item, index, tipo) {
  return `
    <article class="ranking-card">
      <span class="ranking-position">${index + 1}</span>
      <div>
        <p class="book-title">${escapeHtml(item.nome)}</p>
        <p class="book-meta">${escapeHtml(item.detalhe || (tipo === "livro" ? "Livro" : "Cliente"))}</p>
      </div>
      <div class="ranking-numbers">
        <strong>${item.quantidade}</strong>
        <span>${formatarMoeda(item.total)}</span>
      </div>
    </article>
  `;
}

function renderizarHistorico() {
  $("listaHistorico").innerHTML = historico.length
    ? historico.slice(0, 80).map((item) => `
      <article class="history-item">
        <strong>${escapeHtml(item.texto || "")}</strong>
        <span class="history-meta">${formatarData(item.data)} - ${escapeHtml(item.tipo || "movimento")}</span>
      </article>
    `).join("")
    : `<div class="empty-state">O historico ainda esta vazio.</div>`;
}

function cardLivro(livro) {
  const reservado = reservas.filter((item) => item.livroId === livro.id && item.status === "pendente").length;
  return `
    <article class="book-card clickable-card" onclick="selecionarLivroOperacao('${livro.id}')" title="Clique para usar este livro">
      ${imagemCapa(livro)}
      <div>
        <p class="book-title">${escapeHtml(livro.titulo)}</p>
        <p class="book-meta">${escapeHtml(livro.autor)} - ${escapeHtml(livro.categoria || "Geral")} - ${escapeHtml(livro.codigo || "sem codigo")}</p>
        <p class="book-meta">${livro.quantidade} em estoque, ${livro.vendidos} vendido(s), ${reservado} reserva(s)</p>
      </div>
      <div class="book-actions">
        <strong class="book-price">${formatarMoeda(livro.preco)}</strong>
        <button type="button" class="tiny-action" onclick="event.stopPropagation(); selecionarLivroOperacao('${livro.id}')">Usar</button>
      </div>
    </article>
  `;
}

function cardEmprestimo(emprestimo) {
  const livro = buscarLivroPorId(emprestimo.livroId);
  const cliente = buscarClientePorId(emprestimo.clienteId);
  return `
    <article class="loan-card">
      ${imagemCapa(livro || {})}
      <div>
        <p class="book-title">${escapeHtml(livro ? livro.titulo : "Livro removido")}</p>
        <p class="book-meta">${escapeHtml(cliente ? cliente.nome : "Cliente removido")} - emprestado em ${formatarData(emprestimo.data)}</p>
      </div>
      <button type="button" class="primary-action" onclick="devolverEmprestimo('${emprestimo.id}')">Devolver</button>
    </article>
  `;
}

function cardClienteBusca(cliente) {
  const pendentes = emprestimosDoCliente(cliente.id).length;
  return `
    <article class="client-search-card clickable-card" onclick="selecionarClienteOperacao('${cliente.id}')" title="Clique para selecionar cliente">
      <div>
        <p class="book-title">${escapeHtml(cliente.nome)}</p>
        <p class="book-meta">${escapeHtml(cliente.telefone || "Sem telefone")} ${cliente.codigo ? `- ${escapeHtml(cliente.codigo)}` : ""}</p>
      </div>
      <span class="status-pill">${pendentes} pendente(s)</span>
    </article>
  `;
}

function linhaEstoque(livro) {
  const reservado = reservas.filter((item) => item.livroId === livro.id && item.status === "pendente").length;
  return `
    <article class="inventory-row">
      <div>
        <strong>${escapeHtml(livro.titulo)}</strong>
        <div class="book-meta">${escapeHtml(livro.autor)} - ${escapeHtml(livro.codigo || "sem codigo")}</div>
      </div>
      <span>${formatarMoeda(livro.preco)}</span>
      <span class="${livro.quantidade <= 2 ? "stock-low" : "stock-ok"}">${livro.quantidade}</span>
      <span>${livro.vendidos}</span>
      <span>${reservado}</span>
      <div class="mini-actions">
        <button type="button" title="Remover unidade" onclick="ajustarEstoque('${livro.id}', -1)">-</button>
        <button type="button" title="Adicionar unidade" onclick="ajustarEstoque('${livro.id}', 1)">+</button>
        <button type="button" title="Editar livro" onclick="editarLivro('${livro.id}')">Editar</button>
      </div>
    </article>
  `;
}

function linhaAcerto(livro) {
  return `
    <article class="settlement-row">
      <div>
        <strong>${escapeHtml(livro.titulo)}</strong>
        <div class="book-meta">${escapeHtml(livro.codigo || "sem codigo")} - ${margemPorLivro(livro).toFixed(2)}% ganho</div>
      </div>
      <span>${escapeHtml(livro.origem || livrariaInicial)}</span>
      <span>${Number(livro.vendidos || 0)}</span>
      <span>${Number(livro.quantidade || 0)}</span>
      <strong>${caixaVisivel ? formatarMoeda(lucroLivro(livro)) : "****"}</strong>
      <strong>${caixaVisivel ? formatarMoeda(valorPagarLivro(livro)) : "****"}</strong>
      <span>${formatarDataCurta(livro.dataAcerto)}</span>
    </article>
  `;
}

function cardReserva(reserva) {
  const livro = buscarLivroPorId(reserva.livroId);
  return `
    <article class="reservation-card">
      <div>
        <p class="book-title">${escapeHtml(reserva.clienteNome)}</p>
        <p class="book-meta">${escapeHtml(livro ? livro.titulo : "Livro removido")} - ${escapeHtml(reserva.telefone || "sem telefone")}</p>
        <p class="book-meta">${formatarData(reserva.data)}</p>
      </div>
      <div class="mini-actions">
        <button type="button" title="Concluir venda" onclick="concluirReserva('${reserva.id}')">OK</button>
        <button type="button" title="Cancelar reserva" onclick="cancelarReserva('${reserva.id}')">X</button>
      </div>
    </article>
  `;
}

function exportarHistorico() {
  const linhas = [
    ["data", "tipo", "descricao"],
    ...historico.map((item) => [item.data, item.tipo, item.texto])
  ];
  const csv = linhas.map((linha) => linha.map((campo) => `"${String(campo || "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "historico-biblioteca.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function evento(tipo, texto) {
  return { id: cryptoId(), tipo, texto, data: new Date().toISOString() };
}

function buscarLivroPorId(id) {
  return livros.find((livro) => livro.id === id);
}

function buscarClientePorId(id) {
  return clientes.find((cliente) => cliente.id === id);
}

function buscarLivroPorTitulo(titulo) {
  return livros.find((livro) => normalizar(livro.titulo) === normalizar(titulo || ""));
}

function buscarClientePorNome(nome) {
  return clientes.find((cliente) => normalizar(cliente.nome) === normalizar(nome || ""));
}

function emprestimosDoCliente(clienteId) {
  return emprestimos.filter((item) => item.clienteId === clienteId && item.status === "ativo");
}

function idOuVazio(item) {
  return item ? item.id : "";
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limparCodigo(texto) {
  return String(texto || "").replace(/[^0-9A-Za-z-]/g, "").trim();
}

function capaPorIsbn(codigo) {
  const isbn = limparCodigo(codigo);
  if (!isbn || isbn.startsWith("ANTIGO-")) return "";
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
}

function imagemCapa(livro) {
  if (livro.capa) {
    return `<img class="book-cover" src="${escapeHtml(livro.capa)}" alt="Capa de ${escapeHtml(livro.titulo)}" onerror="this.outerHTML='<div class=&quot;book-cover placeholder&quot;>Capa</div>'">`;
  }

  return `<div class="book-cover placeholder">Capa</div>`;
}

function selecionarLivroOperacao(id) {
  const select = $("livroSaida");
  if (select) select.value = id;
  $("quantidadeSaida").value = 1;
  focarSaida();
  avisar("Livro selecionado para operacao.");
}

function selecionarClienteOperacao(id) {
  $("clienteSaida").value = id;
  $("reservaCliente").value = id;
  renderizarFichaCliente();
  preencherTelefoneReserva();
  focarSaida();
  avisar("Cliente selecionado.");
}

function editarLivro(id) {
  const livro = buscarLivroPorId(id);
  if (!livro) return;

  livroEditandoId = id;
  $("codigoLivro").value = livro.codigo || "";
  $("tituloLivro").value = livro.titulo || "";
  $("autorLivro").value = livro.autor || "";
  $("editoraLivro").value = livro.editora || "";
  $("categoriaLivro").value = livro.categoria || "";
  $("precoLivro").value = Number(livro.preco || 0);
  $("custoLivro").value = Number(livro.custo || livro.preco || 0);
  $("custoLivro").dataset.manual = "true";
  $("margemLivro").value = Number.isFinite(Number(livro.margemPercent)) ? Number(livro.margemPercent) : margemPorValores(livro.preco, livro.custo || livro.preco);
  $("quantidadeLivro").value = Number(livro.quantidade || 0);
  $("origemLivro").value = livro.origem || livrariaAtual();
  $("dataAcertoLivro").value = livro.dataAcerto || dataAcertoPadrao();
  $("capaLivro").value = livro.capa || "";
  renderizarCapa(livro.capa || "");
  $("btnSalvarLivro").textContent = "Salvar alteracoes";
  $("btnCancelarEdicaoLivro").classList.remove("hidden");
  ativarTab("entrada");
  $("formLivro").scrollIntoView({ behavior: "smooth", block: "start" });
  avisar("Livro aberto para edicao.");
}

function cancelarEdicaoLivro(renderizar = true) {
  livroEditandoId = "";
  $("btnSalvarLivro").textContent = "Adicionar ao estoque";
  $("btnCancelarEdicaoLivro").classList.add("hidden");
  $("formLivro").reset();
  $("origemLivro").value = livrariaAtual();
  $("margemLivro").value = descontoPadraoLivraria($("origemLivro").value) || "";
  $("quantidadeLivro").value = 1;
  $("dataAcertoLivro").value = dataAcertoPadrao();
  $("custoLivro").dataset.manual = "";
  renderizarCapa("");
  if (renderizar) avisar("Edicao do livro cancelada.");
}

function editarCliente(id) {
  const cliente = buscarClientePorId(id);
  if (!cliente) return;

  clienteEditandoId = id;
  $("nomeCliente").value = cliente.nome || "";
  $("telefoneCliente").value = cliente.telefone || "";
  $("codigoCliente").value = cliente.codigo || "";
  $("btnSalvarCliente").textContent = "Salvar alteracoes";
  $("btnCancelarEdicaoCliente").classList.remove("hidden");
  ativarTab("clientes");
  $("formCliente").scrollIntoView({ behavior: "smooth", block: "start" });
  avisar("Cliente aberto para edicao.");
}

function cancelarEdicaoCliente(renderizar = true) {
  clienteEditandoId = "";
  $("btnSalvarCliente").textContent = "Salvar cliente";
  $("btnCancelarEdicaoCliente").classList.add("hidden");
  $("formCliente").reset();
  if (renderizar) avisar("Edicao do cliente cancelada.");
}

function focarBusca() {
  ativarTab("operacao");
  $("buscaLivro").focus();
  $("buscaLivro").scrollIntoView({ behavior: "smooth", block: "center" });
}

function focarSaida() {
  ativarTab("operacao");
  $("formSaida").scrollIntoView({ behavior: "smooth", block: "center" });
}

function focarDevolucao() {
  ativarTab("operacao");
  $("devolucaoPainel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function verBaixoEstoque() {
  ativarTab("estoque");
  $("filtroEstoque").value = "baixo";
  renderizarEstoque();
}

function valorPagarLivro(livro) {
  return Number(livro.vendidos || 0) * Number(livro.custo || livro.preco || 0);
}

function lucroLivro(livro) {
  return Number(livro.vendidos || 0) * Math.max(0, Number(livro.preco || 0) - Number(livro.custo || livro.preco || 0));
}

function totalAPagarLivraria() {
  return livros.reduce((soma, livro) => soma + valorPagarLivro(livro), 0);
}

function totalLucroLivraria() {
  return livros.reduce((soma, livro) => soma + lucroLivro(livro), 0);
}

function livrariaAtual() {
  return localStorage.getItem(storage.livrariaAtual) || livrariaInicial;
}

function guardarLivrariaAtual(origem) {
  const valor = String(origem || "").trim();
  if (valor) localStorage.setItem(storage.livrariaAtual, valor);
}

function resumoLivrariasAcerto(lista) {
  const grupos = new Map();
  lista.forEach((livro) => {
    const origem = livro.origem || livrariaInicial;
    const atual = grupos.get(origem) || { origem, vendidos: 0, estoque: 0, pagar: 0, lucro: 0 };
    atual.vendidos += Number(livro.vendidos || 0);
    atual.estoque += Number(livro.quantidade || 0);
    atual.pagar += valorPagarLivro(livro);
    atual.lucro += lucroLivro(livro);
    grupos.set(origem, atual);
  });

  return `
    <div class="supplier-summary">
      ${Array.from(grupos.values()).map((item) => `
        <article>
          <strong>${escapeHtml(item.origem)}</strong>
          <span>${item.vendidos} vendido(s), ${item.estoque} em estoque</span>
          <span>Pagar: ${caixaVisivel ? formatarMoeda(item.pagar) : "****"}</span>
          <span>Ganho: ${caixaVisivel ? formatarMoeda(item.lucro) : "****"}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function descontoPadraoLivraria(origem) {
  const texto = normalizar(origem);
  if (!texto) return 0;
  const encontrada = livrariasPadrao.find((livraria) => texto.includes(normalizar(livraria.nome).split(" ")[0]) || normalizar(livraria.nome).includes(texto));
  return encontrada ? encontrada.margem : 0;
}

function calcularRepasse(preco, margemPercent) {
  return Math.round(Number(preco || 0) * (1 - Number(margemPercent || 0) / 100) * 100) / 100;
}

function margemPorValores(preco, custo) {
  const pvp = Number(preco || 0);
  const repasse = Number(custo || 0);
  if (!pvp || repasse > pvp) return 0;
  return Math.round(((pvp - repasse) / pvp) * 10000) / 100;
}

function margemPorLivro(livro) {
  if (Number.isFinite(Number(livro.margemPercent))) return Number(livro.margemPercent);
  return margemPorValores(livro.preco, livro.custo);
}

function dataAcertoPadrao() {
  const data = new Date();
  data.setDate(data.getDate() + 45);
  return data.toISOString().slice(0, 10);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(valor || 0);
}

function formatarData(data) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(data));
}

function formatarDataCurta(data) {
  if (!data) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(data));
}

function cryptoId() {
  if (window.crypto && window.crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function avisar(mensagem) {
  const toast = $("toast");
  toast.textContent = mensagem;
  toast.classList.add("visible");
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => toast.classList.remove("visible"), 2400);
}
