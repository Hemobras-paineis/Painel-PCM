const CSV_URL = "https://docs.google.com/spreadsheets/d/1IGkI1foAYcKUYWSF2jknjaqhrDwXHAuJJ_984qGwSJQ/export?format=csv&gid=1142490697";

const COLUNAS_DESEJADAS = [
    "Status", "Data/hora de Emissão", "Número da OSMC", "Solicitante", "Bloco", "Piso",
    "Equipamento", "Sala", "Descrição do Problema", "Observação", "Motivo", "Data/hora de fechamento", "Planta",
    "MTTR (h)", "MTBF (h)"
];

let allData = [];
let filteredData = [];
const rowsPerPage = 50; 
let currentPage = 1;

let osmcChartInstance = null; 
let blocoChartInstance = null;
let plantaChartInstance = null; 

let isTableVisible = false;

const filterEquipamentoSala = document.getElementById('filterEquipamentoSala');
const filterAnoEmissao = document.getElementById('filterAnoEmissao');
const filterPlanta = document.getElementById('filterPlanta'); 
const filterBloco = document.getElementById('filterBloco');
const btnRefresh = document.getElementById('btnRefresh');
const btnPdfReport = document.getElementById('btnPdfReport');
const reportType = document.getElementById('reportType');
const reportEquipamento = document.getElementById('reportEquipamento');

const loadingState = document.getElementById('loadingState');
const dashboardSummary = document.getElementById('dashboardSummary'); 
const kpiCardsContainer = document.getElementById('kpiCardsContainer'); 
const chartsGrid = document.getElementById('chartsGrid');
const tableToggleContainer = document.getElementById('tableToggleContainer');
const btnToggleTable = document.getElementById('btnToggleTable');
const tableSection = document.getElementById('tableSection');

const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const currentPageIndicator = document.getElementById('currentPageIndicator');
const pageInfo = document.getElementById('pageInfo');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const jumpInput = document.getElementById('jumpInput');
const btnJump = document.getElementById('btnJump');

class MultiSelectDropdown {
    constructor(prefix, textoPadrao, onChange) {
        this.wrapper = document.getElementById(`${prefix}Wrapper`);
        this.btn = document.getElementById(`${prefix}Btn`);
        this.panel = document.getElementById(`${prefix}Panel`);
        this.textoPadrao = textoPadrao;
        this.onChange = onChange;
        this.itens = [];
        this.selecionados = new Set();

        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) this.fecharPanel();
        });
    }

    togglePanel() {
        const estaAberto = !this.panel.hidden;
        document.querySelectorAll('.multi-select-panel').forEach(p => p.hidden = true);
        this.panel.hidden = estaAberto;
    }

    fecharPanel() {
        this.panel.hidden = true;
    }

    preencher(itens) {
        const selecionadosAnteriores = new Set(
            Array.from(this.selecionados).filter(valor => itens.some(item => item.value === valor))
        );
        this.itens = itens;
        this.selecionados = selecionadosAnteriores;

        this.panel.innerHTML = '';

        const acoes = document.createElement('div');
        acoes.className = 'multi-select-panel-actions';
        const btnTodos = document.createElement('button');
        btnTodos.type = 'button';
        btnTodos.textContent = 'Selecionar todos';
        btnTodos.addEventListener('click', () => {
            this.selecionados = new Set(this.itens.map(item => item.value));
            this.atualizarCheckboxes();
            this.atualizarTexto();
            this.onChange();
        });
        const btnNenhum = document.createElement('button');
        btnNenhum.type = 'button';
        btnNenhum.textContent = 'Limpar';
        btnNenhum.addEventListener('click', () => {
            this.selecionados = new Set();
            this.atualizarCheckboxes();
            this.atualizarTexto();
            this.onChange();
        });
        acoes.appendChild(btnTodos);
        acoes.appendChild(btnNenhum);
        this.panel.appendChild(acoes);

        itens.forEach(({ value, label }) => {
            const opcao = document.createElement('label');
            opcao.className = 'multi-select-option';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = value;
            checkbox.checked = this.selecionados.has(value);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) this.selecionados.add(value);
                else this.selecionados.delete(value);
                this.atualizarTexto();
                this.onChange();
            });
            const texto = document.createElement('span');
            texto.textContent = label;
            opcao.appendChild(checkbox);
            opcao.appendChild(texto);
            this.panel.appendChild(opcao);
        });

        this.atualizarTexto();
    }

    atualizarCheckboxes() {
        this.panel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = this.selecionados.has(checkbox.value);
        });
    }

    atualizarTexto() {
        if (this.selecionados.size === 0) {
            this.btn.textContent = this.textoPadrao;
        } else if (this.selecionados.size === 1) {
            const item = this.itens.find(item => this.selecionados.has(item.value));
            this.btn.textContent = item ? item.label : this.textoPadrao;
        } else {
            this.btn.textContent = `${this.selecionados.size} selecionados`;
        }
    }

    getSelecionados() {
        return this.selecionados;
    }
}

const filterStatusDropdown = new MultiSelectDropdown('filterStatus', 'Todos os Status', () => aplicarFiltrosGerais());
const filterEmpresaResponsavelDropdown = new MultiSelectDropdown('filterEmpresaResponsavel', 'Todas as Empresas Responsáveis', () => aplicarFiltrosGerais());
const filterMesEmissaoDropdown = new MultiSelectDropdown('filterMesEmissao', 'Todos os Meses de Emissão', () => aplicarFiltrosGerais());

function init() {
    Chart.register(ChartDataLabels);
    fetchData();
    setInterval(() => { fetchData(true); }, 10800000); 
}

btnRefresh.addEventListener('click', () => { fetchData(false); });

btnToggleTable.addEventListener('click', () => {
    isTableVisible = !isTableVisible;
    if(isTableVisible) {
        tableSection.style.display = 'block';
        btnToggleTable.textContent = 'Ocultar Lista de O.S. (Detalhamento)';
        btnToggleTable.style.backgroundColor = '#444'; 
    } else {
        tableSection.style.display = 'none';
        btnToggleTable.textContent = 'Visualizar Lista de O.S. (Detalhamento)';
        btnToggleTable.style.backgroundColor = 'var(--primary-color)'; 
    }
});

function parseDataHora(str) {
    if (!str || str === '-' || str.trim() === '') return null;
    str = str.trim();

    const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (brMatch) {
        const dia = parseInt(brMatch[1], 10);
        const mes = parseInt(brMatch[2], 10) - 1;
        const ano = parseInt(brMatch[3], 10);
        const hora = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
        const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
        const seg = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
        return new Date(ano, mes, dia, hora, min, seg);
    }

    const isoDate = new Date(str);
    return isNaN(isoDate.getTime()) ? null : isoDate;
}

function calcularMetricasLinhaALinha(dados) {
    const equipamentosMap = new Map();

    dados.forEach((row, index) => {
        const equip = (row[6] && row[6] !== '-') ? row[6].toString().trim().toUpperCase() : null;
        const dataEmissao = parseDataHora(row[1]);
        const dataFechamento = parseDataHora(row[11]);
        const status = row[0] ? row[0].replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';

        let mttrIndividual = '-';
        if (isStatusResolvido(status) && dataEmissao && dataFechamento && dataFechamento >= dataEmissao) {
            const horas = (dataFechamento - dataEmissao) / (1000 * 60 * 60);
            mttrIndividual = horas.toFixed(1);
        }
        row[13] = mttrIndividual;

        if (equip && dataEmissao) {
            if (!equipamentosMap.has(equip)) {
                equipamentosMap.set(equip, []);
            }
            equipamentosMap.get(equip).push({
                index,
                dataEmissao,
                dataFechamento
            });
        } else {
            row[14] = '-';
        }
    });

    equipamentosMap.forEach((ocorrencias) => {
        ocorrencias.sort((a, b) => a.dataEmissao - b.dataEmissao);

        ocorrencias.forEach((item, i) => {
            if (i === 0) {
                dados[item.index][14] = '-';
            } else {
                const anterior = ocorrencias[i - 1];
                const pontoPartida = (anterior.dataFechamento && anterior.dataFechamento <= item.dataEmissao)
                    ? anterior.dataFechamento
                    : anterior.dataEmissao;

                const diffHoras = (item.dataEmissao - pontoPartida) / (1000 * 60 * 60);
                dados[item.index][14] = diffHoras >= 0 ? diffHoras.toFixed(1) : '-';
            }
        });
    });
}

function fetchData(isSilentUpdate = false) {
    if (!isSilentUpdate) {
        loadingState.style.display = 'block';
        dashboardSummary.style.display = 'none'; 
        chartsGrid.style.display = 'none';
        tableToggleContainer.style.display = 'none';
        if(isTableVisible) tableSection.style.display = 'none';
    }

    Papa.parse(CSV_URL, {
        download: true,
        header: false,
        skipEmptyLines: true,
        complete: function(results) {
            const rawData = results.data;
            let headerIndex = -1;

            for (let i = 0; i < rawData.length; i++) {
                if (rawData[i].includes("Número da OSMC")) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) {
                if (!isSilentUpdate) loadingState.innerHTML = '<span style="color:red">Erro: Cabeçalho não encontrado.</span>';
                return;
            }

            const headerRow = rawData[headerIndex];
            const colunasBase = COLUNAS_DESEJADAS.slice(0, 13);
            let colIndices = colunasBase.map(colName => {
                let index = headerRow.findIndex(h => h && h.trim().toLowerCase() === colName.toLowerCase());
                if (index === -1) index = headerRow.findIndex(h => h && h.toLowerCase().includes(colName.toLowerCase()));
                if (index === -1 && colName === "Status") {
                    index = headerRow.findIndex(h => h && (h.toLowerCase().includes("pendente") || h.toLowerCase().includes("situação") || h.toLowerCase().includes("status")));
                }
                return index;
            });

            const statusIdx = colIndices[0];
            let empresaResponsavelIdx = headerRow.findIndex(h => h &&
                h.trim().toLowerCase().includes('empresa responsável'));
            if (empresaResponsavelIdx === -1) {
                empresaResponsavelIdx = headerRow.findIndex(h => h && h.trim().toLowerCase().includes('empresa'));
            }
            const osmcIdx = colIndices[2];   
            
            allData = [];

            for (let j = headerIndex + 1; j < rawData.length; j++) {
                let row = rawData[j];
                if (!row || row.length === 0 || osmcIdx === -1) continue;

                let osmcVal = row[osmcIdx] ? row[osmcIdx].toString().trim() : "";
                let statusVal = (statusIdx !== -1 && row[statusIdx]) ? row[statusIdx].toString().trim() : "";
                let statusValido = statusVal !== "" && statusVal !== "-"; 
                
                let anoValido = false;
                if (osmcVal.includes("2025") || osmcVal.includes("2026") || osmcVal.includes("2027")) {
                    anoValido = true;
                }

                if (osmcVal && osmcVal.includes("/") && osmcVal.toLowerCase() !== "número da osmc" && anoValido && statusValido) {
                    const newRow = colIndices.map(cIdx => {
                        return (cIdx !== -1 && row[cIdx]) ? row[cIdx].toString().trim() : "-";
                    });
                    newRow[13] = "-";
                    newRow[14] = "-";
                    newRow.empresaResponsavel = empresaResponsavelIdx !== -1 && row[empresaResponsavelIdx] ?
                        row[empresaResponsavelIdx].toString().trim() : "-";
                    allData.push(newRow);
                }
            }

            allData.reverse();

            calcularMetricasLinhaALinha(allData);

            popularFiltrosDinamicos();
            aplicarFiltrosGerais();
            renderTableHeaders();
            
            loadingState.style.display = 'none';
            dashboardSummary.style.display = 'flex'; 
            chartsGrid.style.display = 'grid';
            tableToggleContainer.style.display = 'block';
            if(isTableVisible) tableSection.style.display = 'block';
        }
    });
}

function popularFiltrosDinamicos() {
    const statusSet = new Set();
    const empresaResponsavelSet = new Set();
    const mesesEmissao = new Map();
    const anosEmissao = new Set();
    const plantaSet = new Set(); 
    const blocoSet = new Set();
    const equipamentoSet = new Set();

    allData.forEach(row => {
        let cleanStatus = row[0] !== "-" ? row[0].replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : "-";
        
        if (cleanStatus !== "-") statusSet.add(cleanStatus); 
        if (row.empresaResponsavel !== "-") empresaResponsavelSet.add(row.empresaResponsavel);
        const mesEmissao = getMesEmissao(row[1]);
        if (mesEmissao) {
            mesesEmissao.set(mesEmissao.chave, mesEmissao);
            anosEmissao.add(String(mesEmissao.ano));
        }
        if (row[4] !== "-") blocoSet.add(row[4]);
        if (row[12] && row[12] !== "-") plantaSet.add(row[12]);
        if (row[6] && row[6] !== "-" && row[6].toLowerCase() !== "n/a") equipamentoSet.add(row[6]);
    });

    function preencherSelect(selectElement, valoresSet, ordenar = true) {
        if (!selectElement) return;
        const valorAtual = selectElement.value;
        const textoPadrao = selectElement.options[0].text;
        selectElement.innerHTML = `<option value="">${textoPadrao}</option>`;
        
        const valores = Array.from(valoresSet);
        if (ordenar) valores.sort();
        valores.forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            if (valor === valorAtual) option.selected = true; 
            selectElement.appendChild(option);
        });
    }

    preencherSelect(filterAnoEmissao, anosEmissao);
    filterStatusDropdown.preencher(Array.from(statusSet).sort().map(valor => ({ value: valor, label: valor })));
    filterEmpresaResponsavelDropdown.preencher(Array.from(empresaResponsavelSet).sort().map(valor => ({ value: valor, label: valor })));
    filterMesEmissaoDropdown.preencher(Array.from(mesesEmissao.values())
        .filter(mes => !filterAnoEmissao.value || String(mes.ano) === filterAnoEmissao.value)
        .sort((a, b) => a.chave.localeCompare(b.chave))
        .map(mes => ({ value: mes.chave, label: formatarMesEmissao(mes) })));
    preencherSelect(filterPlanta, plantaSet); 
    preencherSelect(filterBloco, blocoSet);
    preencherSelect(reportEquipamento, equipamentoSet);
}

function aplicarFiltrosGerais() {
    const statusFiltro = filterStatusDropdown.getSelecionados();
    const empresaResponsavelFiltro = filterEmpresaResponsavelDropdown.getSelecionados();
    const anoEmissaoFiltro = filterAnoEmissao.value;
    const mesesEmissaoFiltro = filterMesEmissaoDropdown.getSelecionados();
    const plantaFiltro = filterPlanta.value; 
    const blocoFiltro = filterBloco.value;
    const buscaFiltro = filterEquipamentoSala.value.trim().toLowerCase();

    filteredData = allData.filter(row => {
        let cleanStatus = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';

        const passouStatus = statusFiltro.size === 0 || statusFiltro.has(cleanStatus);
        const passouEmpresaResponsavel = empresaResponsavelFiltro.size === 0 ||
            empresaResponsavelFiltro.has(row.empresaResponsavel);
        const mesEmissao = getMesEmissao(row[1]);
        const passouAnoEmissao = !anoEmissaoFiltro || (mesEmissao && String(mesEmissao.ano) === anoEmissaoFiltro);
        const passouMesEmissao = mesesEmissaoFiltro.size === 0 ||
            (mesEmissao && mesesEmissaoFiltro.has(mesEmissao.chave));
        const passouPlanta = !plantaFiltro || row[12] === plantaFiltro; 
        const passouBloco = !blocoFiltro || row[4] === blocoFiltro;

        const osmcVal = row[2] ? row[2].toString().toLowerCase() : '';
        const equipamentoVal = row[6] ? row[6].toString().toLowerCase() : '';
        const salaVal = row[7] ? row[7].toString().toLowerCase() : '';
        const passouBusca = !buscaFiltro ||
            osmcVal.includes(buscaFiltro) ||
            equipamentoVal.includes(buscaFiltro) || 
            salaVal.includes(buscaFiltro);

        return passouStatus && passouEmpresaResponsavel && passouAnoEmissao && passouMesEmissao &&
            passouPlanta && passouBloco && passouBusca;
    });

    currentPage = 1;
    renderTableBody();
    updatePagination();
    
    atualizarDashboards(); 
}

function getTopNData(dataArray, colIndex, topN) {
    const counts = {};
    dataArray.forEach(row => {
        let val = row[colIndex] ? row[colIndex].toString().trim() : '';
        if (val && val !== '-' && val.toLowerCase() !== 'n/a') {
            counts[val] = (counts[val] || 0) + 1;
        }
    });

    const sorted = Object.keys(counts)
        .map(key => ({ label: key, count: counts[key] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);

    return {
        labels: sorted.map(item => item.label),
        data: sorted.map(item => item.count)
    };
}

function getExecucaoMensalStats(dataArray) {
    const dadosPorMes = new Map();

    dataArray.forEach(row => {
        const mesEmissao = getMesEmissao(row[1]);
        if (!mesEmissao) return;

        if (!dadosPorMes.has(mesEmissao.chave)) {
            dadosPorMes.set(mesEmissao.chave, { ...mesEmissao, total: 0, resolvidas: 0 });
        }

        const dadosMes = dadosPorMes.get(mesEmissao.chave);
        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        dadosMes.total++;
        if (isStatusResolvido(status)) dadosMes.resolvidas++;
    });

    const meses = Array.from(dadosPorMes.values()).sort((a, b) => a.chave.localeCompare(b.chave));
    return {
        labels: meses.map(formatarMesEmissao),
        data: meses.map(mes => Math.round((mes.resolvidas / mes.total) * 1000) / 10)
    };
}

function getExecucaoPorPlantaStats(dataArray) {
    const dadosPorPlanta = new Map();

    dataArray.forEach(row => {
        const planta = row[12] ? row[12].toString().trim() : '';
        if (!planta || planta === '-' || planta.toLowerCase() === 'n/a') return;

        if (!dadosPorPlanta.has(planta)) {
            dadosPorPlanta.set(planta, { total: 0, resolvidas: 0 });
        }

        const dados = dadosPorPlanta.get(planta);
        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        dados.total++;
        if (isStatusResolvido(status)) dados.resolvidas++;
    });

    const plantas = Array.from(dadosPorPlanta.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

    return {
        labels: plantas.map(([planta]) => planta),
        data: plantas.map(([, dados]) => Math.round((dados.resolvidas / dados.total) * 1000) / 10)
    };
}

function isStatusResolvido(status) {
    const statusMin = status.toLowerCase();
    return statusMin.includes('aprovado') || statusMin.includes('concluído') ||
        statusMin.includes('concluido') || statusMin.includes('resolvido');
}

function getMesEmissao(dataEmissao) {
    if (!dataEmissao || dataEmissao === '-') return null;

    const correspondenciaBrasileira = dataEmissao.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const correspondenciaIso = dataEmissao.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    let ano;
    let mes;

    if (correspondenciaBrasileira) {
        ano = Number(correspondenciaBrasileira[3]);
        mes = Number(correspondenciaBrasileira[2]);
    } else if (correspondenciaIso) {
        ano = Number(correspondenciaIso[1]);
        mes = Number(correspondenciaIso[2]);
    } else {
        return null;
    }

    if (mes < 1 || mes > 12) return null;
    return { chave: `${ano}-${String(mes).padStart(2, '0')}`, ano, mes };
}

function formatarMesEmissao({ mes, ano }) {
    const mesesAbreviados = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${mesesAbreviados[mes - 1]}/${String(ano).slice(-2)}`;
}

function getStatusPorMes(data) {
    const dadosPorMes = new Map();

    data.forEach(row => {
        const mesEmissao = getMesEmissao(row[1]);
        if (!mesEmissao) return;

        if (!dadosPorMes.has(mesEmissao.chave)) {
            dadosPorMes.set(mesEmissao.chave, { ...mesEmissao, pendentes: 0, resolvidas: 0 });
        }

        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        const dadosMes = dadosPorMes.get(mesEmissao.chave);
        if (isStatusResolvido(status)) {
            dadosMes.resolvidas++;
        } else {
            dadosMes.pendentes++;
        }
    });

    return Array.from(dadosPorMes.values()).sort((a, b) => a.chave.localeCompare(b.chave));
}

function calcularMetricasGerais(dados) {
    let tempoReparacaoTotalHoras = 0;
    let ordensFechadasComData = 0;
    let menorDataEmissao = null;
    let maiorData = null;

    dados.forEach(row => {
        const dataEmissao = parseDataHora(row[1]);
        const dataFechamento = parseDataHora(row[11]);
        const status = row[0] ? row[0].replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';

        if (dataEmissao) {
            if (!menorDataEmissao || dataEmissao < menorDataEmissao) menorDataEmissao = dataEmissao;
            if (!maiorData || dataEmissao > maiorData) maiorData = dataEmissao;
        }

        if (dataFechamento) {
            if (!maiorData || dataFechamento > maiorData) maiorData = dataFechamento;
        }

        if (isStatusResolvido(status) && dataEmissao && dataFechamento && dataFechamento >= dataEmissao) {
            const diffHoras = (dataFechamento - dataEmissao) / (1000 * 60 * 60);
            tempoReparacaoTotalHoras += diffHoras;
            ordensFechadasComData++;
        }
    });

    const mttr = ordensFechadasComData > 0 
        ? (tempoReparacaoTotalHoras / ordensFechadasComData).toFixed(1) 
        : '0.0';

    let mtbf = '0.0';
    const totalFalhas = dados.length;
    if (totalFalhas > 0 && menorDataEmissao && maiorData && maiorData > menorDataEmissao) {
        const periodoTotalHoras = (maiorData - menorDataEmissao) / (1000 * 60 * 60);
        const tempoOperacionalHoras = Math.max(0, periodoTotalHoras - tempoReparacaoTotalHoras);
        mtbf = (tempoOperacionalHoras / totalFalhas).toFixed(1);
    }

    return { mttr, mtbf, tempoReparacaoTotalHoras, ordensFechadasComData };
}

function obterEstiloStatus(status) {
    const valMin = (status || '').toLowerCase();
    if (valMin.includes('resolvido') || valMin.includes('concluído') || valMin.includes('concluido') || valMin.includes('aprovado')) {
        return { cor: [21, 87, 36], fundo: [212, 237, 218], tipo: 'check' };
    } else if (valMin.includes('pendente') || valMin.includes('aguardando')) {
        return { cor: [133, 100, 4], fundo: [255, 243, 205], tipo: 'alerta' };
    } else if (valMin.includes('parado')) {
        return { cor: [56, 61, 65], fundo: [226, 227, 229], tipo: 'pausa' };
    } else if (valMin.includes('cancelado')) {
        return { cor: [114, 28, 36], fundo: [248, 215, 218], tipo: 'x' };
    } else if (valMin.includes('execução') || valMin.includes('execucao')) {
        return { cor: [0, 64, 133], fundo: [204, 229, 255], tipo: 'engrenagem' };
    }
    return { cor: [33, 37, 41], fundo: [248, 249, 250], tipo: 'padrao' };
}

function desenharIconeStatus(pdf, status, x, y) {
    const estilo = obterEstiloStatus(status);
    const cx = x + 1.6;
    const cy = y - 1.2;
    pdf.setFillColor(estilo.fundo[0], estilo.fundo[1], estilo.fundo[2]);
    pdf.circle(cx, cy, 1.8, 'F');
    pdf.setDrawColor(estilo.cor[0], estilo.cor[1], estilo.cor[2]);
    pdf.setLineWidth(0.35);
    if (estilo.tipo === 'check') {
        pdf.line(cx - 0.9, cy, cx - 0.2, cy + 0.7);
        pdf.line(cx - 0.2, cy + 0.7, cx + 1, cy - 0.8);
    } else if (estilo.tipo === 'x') {
        pdf.line(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8);
        pdf.line(cx - 0.8, cy + 0.8, cx + 0.8, cy - 0.8);
    } else if (estilo.tipo === 'alerta') {
        pdf.line(cx, cy - 0.9, cx, cy + 0.3);
        pdf.setFillColor(estilo.cor[0], estilo.cor[1], estilo.cor[2]);
        pdf.circle(cx, cy + 0.9, 0.15, 'F');
    } else if (estilo.tipo === 'pausa') {
        pdf.setLineWidth(0.5);
        pdf.line(cx - 0.5, cy - 0.8, cx - 0.5, cy + 0.8);
        pdf.line(cx + 0.5, cy - 0.8, cx + 0.5, cy + 0.8);
    } else if (estilo.tipo === 'engrenagem') {
        pdf.setFillColor(estilo.cor[0], estilo.cor[1], estilo.cor[2]);
        pdf.circle(cx, cy, 0.9, 'F');
        pdf.setFillColor(estilo.fundo[0], estilo.fundo[1], estilo.fundo[2]);
        pdf.circle(cx, cy, 0.4, 'F');
    } else {
        pdf.setFillColor(estilo.cor[0], estilo.cor[1], estilo.cor[2]);
        pdf.circle(cx, cy, 0.7, 'F');
    }
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(0);
}

function gerarRelatorioPdfMensal() {
    if (!window.jspdf) {
        alert('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.');
        return;
    }

    const somentePendencias = reportType.value === 'pendencias';
    const equipSelecionado = (reportEquipamento.value || '').trim();

    // Filtra pelo tipo de relatório e pelo equipamento selecionado
    let registrosRelatorio = filteredData.filter(row => {
        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        const passouStatus = !somentePendencias || !isStatusResolvido(status);
        const equipRow = row[6] ? row[6].toString().trim() : '';
        const passouEquip = !equipSelecionado || equipRow.toLowerCase() === equipSelecionado.toLowerCase();
        return passouStatus && passouEquip;
    });

    const meses = getStatusPorMes(registrosRelatorio);
    if (registrosRelatorio.length === 0) {
        alert('Não há registros para os filtros selecionados.');
        return;
    }

    const metricas = calcularMetricasGerais(registrosRelatorio);
    let resolvidas = 0;
    let pendentes = 0;
    registrosRelatorio.forEach(row => {
        const s = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        if (isStatusResolvido(s)) resolvidas++;
        else pendentes++;
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const larguraPagina = pdf.internal.pageSize.getWidth();
    const alturaPagina = pdf.internal.pageSize.getHeight();
    const mesesPorPagina = 6;
    const empresasSelecionadas = Array.from(filterEmpresaResponsavelDropdown.getSelecionados());
    const empresaResponsavel = empresasSelecionadas.length > 0 ? empresasSelecionadas.join(', ') : 'Todas as empresas responsáveis';
    
    let tituloRelatorio = somentePendencias
        ? 'Relatório de Pendências de Manutenção Corretiva'
        : 'Relatório Completo de Manutenção Corretiva';
    
    if (equipSelecionado) {
        tituloRelatorio += ` - Equipamento: ${equipSelecionado}`;
    }

    function desenharCabecalho(titulo, subtitulo) {
        pdf.setFillColor(138, 21, 27);
        pdf.rect(0, 0, larguraPagina, 10, 'F');
        pdf.setFillColor(204, 166, 74);
        pdf.rect(0, 10, larguraPagina, 1.5, 'F');
        pdf.setTextColor(138, 21, 27);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.text('HEMOBRAS', 24, 23);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(80);
        pdf.text('EMPRESA BRASILEIRA DE HEMODERIVADOS E BIOTECNOLOGIA', 24, 28);
        pdf.setTextColor(35);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.text(titulo, 24, 37);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(80);
        pdf.text(subtitulo, 24, 43);
        pdf.text(`Empresa responsável: ${empresaResponsavel} | Equipamento: ${equipSelecionado || 'Todos'}`, 24, 48);
        pdf.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, larguraPagina - 16, 28, { align: 'right' });
        pdf.setTextColor(0);
    }

    function desenharResumoIndicadores(yTop) {
        const cards = [
            { titulo: 'TOTAL O.S.', valor: String(registrosRelatorio.length), cor: [138, 21, 27] },
            { titulo: 'RESOLVIDAS', valor: String(resolvidas), cor: [21, 87, 36] },
            { titulo: 'BACKLOG (PEND.)', valor: String(pendentes), cor: [200, 35, 51] },
            { titulo: 'MTTR MÉDIO', valor: `${metricas.mttr} h`, cor: [180, 130, 0] },
            { titulo: 'MTBF MÉDIO', valor: `${metricas.mtbf} h`, cor: [17, 122, 139] }
        ];

        const larguraCard = 48;
        const alturaCard = 15;
        const gap = 6;
        const inicioX = (larguraPagina - (cards.length * larguraCard + (cards.length - 1) * gap)) / 2;

        cards.forEach((c, idx) => {
            const x = inicioX + idx * (larguraCard + gap);
            pdf.setFillColor(248, 249, 250);
            pdf.roundedRect(x, yTop, larguraCard, alturaCard, 2, 2, 'F');
            pdf.setFillColor(c.cor[0], c.cor[1], c.cor[2]);
            pdf.rect(x, yTop, 3, alturaCard, 'F');
            pdf.setDrawColor(220);
            pdf.roundedRect(x, yTop, larguraCard, alturaCard, 2, 2, 'S');

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(7);
            pdf.setTextColor(100);
            pdf.text(c.titulo, x + 6, yTop + 5);

            pdf.setFontSize(10.5);
            pdf.setTextColor(c.cor[0], c.cor[1], c.cor[2]);
            pdf.text(c.valor, x + 6, yTop + 11.5);
        });
        pdf.setTextColor(0);
    }

    // PÁGINA 1: Cabeçalho, Resumo de Indicadores e Gráficos Mensais
    desenharCabecalho(tituloRelatorio, 'Indicadores Gerais de Desempenho e Distribuição Mensal');
    desenharResumoIndicadores(53);

    const margemEsquerda = 28;
    const margemDireita = 20;
    const topoGrafico = 76;
    const baseGrafico = alturaPagina - 25;
    const alturaGrafico = baseGrafico - topoGrafico;
    const larguraGrafico = larguraPagina - margemEsquerda - margemDireita;

    const mesesExibicao = meses.slice(0, mesesPorPagina);
    const maiorValor = Math.max(...mesesExibicao.flatMap(mes => [mes.pendentes, mes.resolvidas, mes.pendentes + mes.resolvidas]), 1);
    const larguraGrupo = larguraGrafico / (mesesExibicao.length || 1);
    const larguraBarra = Math.min(16, larguraGrupo * 0.22);
    const espacamentoBarra = larguraBarra + 2;

    // Legenda do gráfico
    pdf.setFontSize(8.5);
    pdf.setFillColor(0, 64, 133);
    pdf.rect(margemEsquerda, 70, 4, 4, 'F');
    pdf.text('Total', margemEsquerda + 6, 73.5);
    pdf.setFillColor(21, 87, 36);
    pdf.rect(margemEsquerda + 28, 70, 4, 4, 'F');
    pdf.text('Resolvidas', margemEsquerda + 34, 73.5);
    pdf.setFillColor(220, 53, 69);
    pdf.rect(margemEsquerda + 68, 70, 4, 4, 'F');
    pdf.text('Pendentes', margemEsquerda + 74, 73.5);

    // Linhas de grade
    for (let linha = 0; linha <= 5; linha++) {
        const valor = Math.round((maiorValor * linha) / 5);
        const y = baseGrafico - (alturaGrafico * linha / 5);
        pdf.setDrawColor(230);
        pdf.line(margemEsquerda, y, larguraPagina - margemDireita, y);
        pdf.setFontSize(7.5);
        pdf.setTextColor(100);
        pdf.text(String(valor), margemEsquerda - 3, y + 1, { align: 'right' });
        pdf.setTextColor(0);
    }

    pdf.setDrawColor(150);
    pdf.line(margemEsquerda, topoGrafico, margemEsquerda, baseGrafico);
    pdf.line(margemEsquerda, baseGrafico, larguraPagina - margemDireita, baseGrafico);

    mesesExibicao.forEach((mes, indice) => {
        const total = mes.pendentes + mes.resolvidas;
        const centroGrupo = margemEsquerda + (larguraGrupo * indice) + (larguraGrupo / 2);
        const alturaTotal = (total / maiorValor) * alturaGrafico;
        const alturaResolvida = (mes.resolvidas / maiorValor) * alturaGrafico;
        const alturaPendente = (mes.pendentes / maiorValor) * alturaGrafico;
        const xTotal = centroGrupo - espacamentoBarra * 1.5;
        const xResolvida = centroGrupo - larguraBarra / 2;
        const xPendente = centroGrupo + espacamentoBarra * 1.5 - larguraBarra;

        pdf.setFillColor(0, 64, 133);
        pdf.rect(xTotal, baseGrafico - alturaTotal, larguraBarra, alturaTotal, 'F');
        pdf.setFillColor(21, 87, 36);
        pdf.rect(xResolvida, baseGrafico - alturaResolvida, larguraBarra, alturaResolvida, 'F');
        pdf.setFillColor(220, 53, 69);
        pdf.rect(xPendente, baseGrafico - alturaPendente, larguraBarra, alturaPendente, 'F');

        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 64, 133);
        pdf.text(String(total), xTotal + larguraBarra / 2, baseGrafico - alturaTotal - 2, { align: 'center' });
        pdf.setTextColor(21, 87, 36);
        pdf.text(String(mes.resolvidas), xResolvida + larguraBarra / 2, baseGrafico - alturaResolvida - 2, { align: 'center' });
        pdf.setTextColor(220, 53, 69);
        pdf.text(String(mes.pendentes), xPendente + larguraBarra / 2, baseGrafico - alturaPendente - 2, { align: 'center' });
        pdf.setTextColor(0);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(formatarMesEmissao(mes), centroGrupo, baseGrafico + 6, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
    });

    // PÁGINA 2 em diante: Lista Detalhada com MTTR e MTBF individuais
    const margemEsquerdaTabela = 14;
    const colunas = [
        { titulo: 'Nº OSMC', x: 14, largura: 22 },
        { titulo: 'Emissão', x: 36, largura: 20 },
        { titulo: 'Status', x: 56, largura: 28 },
        { titulo: 'Equipamento', x: 84, largura: 30 },
        { titulo: 'Bloco', x: 114, largura: 14 },
        { titulo: 'MTTR', x: 128, largura: 16 },
        { titulo: 'MTBF', x: 144, largura: 16 },
        { titulo: 'Descrição do problema', x: 160, largura: 60 },
        { titulo: 'Motivo', x: 220, largura: 65 }
    ];

    const yCabecalhoTabela = 55;
    const alturaLinhaTexto = 3.5;
    const yLimite = alturaPagina - 15;
    let yAtual;
    let indiceLinha = 0;

    function iniciarPaginaTabela() {
        pdf.addPage();
        desenharCabecalho(
            somentePendencias ? 'Ordens de Serviço Pendentes' : 'Lista Completa de Ordens de Serviço',
            `Registros detalhados | Total no filtro: ${registrosRelatorio.length}`
        );
        pdf.setFillColor(138, 21, 27);
        pdf.rect(margemEsquerdaTabela, yCabecalhoTabela, larguraPagina - 28, 7.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(255);
        colunas.forEach(col => pdf.text(col.titulo, col.x, yCabecalhoTabela + 5));
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        yAtual = yCabecalhoTabela + 7.5;
        indiceLinha = 0;
    }

    iniciarPaginaTabela();

    registrosRelatorio.forEach(row => {
        const descricao = row[8] && row[8] !== '-' ? String(row[8]) : '-';
        const motivo = row[10] && row[10] !== '-' ? String(row[10]) : '-';
        const linhasDescricao = pdf.splitTextToSize(descricao, colunas[7].largura - 2);
        const linhasMotivo = pdf.splitTextToSize(motivo, colunas[8].largura - 2);
        const maxLinhasPorBloco = 25;
        const totalLinhas = Math.max(linhasDescricao.length, linhasMotivo.length);

        for (let inicioBloco = 0; inicioBloco < totalLinhas; inicioBloco += maxLinhasPorBloco) {
            const descBloco = linhasDescricao.slice(inicioBloco, inicioBloco + maxLinhasPorBloco);
            const motBloco = linhasMotivo.slice(inicioBloco, inicioBloco + maxLinhasPorBloco);
            const alturaLinha = Math.max(9, Math.max(descBloco.length, motBloco.length) * alturaLinhaTexto + 3.5);

            if (yAtual + alturaLinha > yLimite) iniciarPaginaTabela();

            if (indiceLinha % 2 === 0) {
                pdf.setFillColor(248, 241, 242);
                pdf.rect(margemEsquerdaTabela, yAtual, larguraPagina - 28, alturaLinha, 'F');
            }
            pdf.setDrawColor(220);
            pdf.line(margemEsquerdaTabela, yAtual + alturaLinha, larguraPagina - margemEsquerdaTabela, yAtual + alturaLinha);

            if (inicioBloco === 0) {
                // OSMC, Emissão, Status, Equipamento, Bloco, MTTR, MTBF
                pdf.text(pdf.splitTextToSize(String(row[2] || '-'), colunas[0].largura - 2)[0], colunas[0].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row[1] || '-'), colunas[1].largura - 2)[0], colunas[1].x, yAtual + 5.5);

                const statusLimpo = String(row[0] || '-').replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim();
                desenharIconeStatus(pdf, statusLimpo, colunas[2].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(statusLimpo, colunas[2].largura - 6)[0], colunas[2].x + 4.5, yAtual + 5.5);

                pdf.text(pdf.splitTextToSize(String(row[6] || '-'), colunas[3].largura - 2)[0], colunas[3].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row[4] || '-'), colunas[4].largura - 2)[0], colunas[4].x, yAtual + 5.5);

                const mttrTexto = row[13] !== '-' ? `${row[13]} h` : '-';
                const mtbfTexto = row[14] !== '-' ? `${row[14]} h` : '-';
                pdf.text(mttrTexto, colunas[5].x, yAtual + 5.5);
                pdf.text(mtbfTexto, colunas[6].x, yAtual + 5.5);
            }

            pdf.text(descBloco, colunas[7].x, yAtual + 5.5);
            pdf.text(motBloco, colunas[8].x, yAtual + 5.5);
            yAtual += alturaLinha;
            indiceLinha++;
        }
    });

    const nomeArquivo = equipSelecionado 
        ? `relatorio-osmc-${equipSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : (somentePendencias ? 'relatorio-osmc-pendencias.pdf' : 'relatorio-osmc-completo.pdf');

    pdf.save(nomeArquivo);
}

function atualizarDashboards() {
    let resolvidas = 0;
    let pendentes = 0;

    filteredData.forEach(row => {
        let status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        if (status && status !== '-') {
            if (isStatusResolvido(status)) {
                resolvidas++;
            } else {
                pendentes++;
            }
        }
    });

    const { mttr, mtbf } = calcularMetricasGerais(filteredData);
    const backlog = pendentes;

    kpiCardsContainer.innerHTML = `
        <div class="kpi-card" style="border-left-color: var(--primary-color);">
            <h3>Total Filtrado</h3>
            <p style="color: var(--primary-color)">${filteredData.length}</p>
        </div>
        <div class="kpi-card" style="border-left-color: #155724;">
            <h3>O.S Resolvidas</h3>
            <p style="color: #155724">${resolvidas}</p>
        </div>
        <div class="kpi-card" style="border-left-color: #c82333;">
            <h3>Backlog (Pendentes)</h3>
            <p style="color: #c82333">${backlog}</p>
        </div>
        <div class="kpi-card" style="border-left-color: #e0a800;">
            <h3>MTTR Médio</h3>
            <p style="color: #b38600">${mttr} <span style="font-size: 13px; font-weight: normal; color: #666;">h</span></p>
        </div>
        <div class="kpi-card" style="border-left-color: #17a2b8;">
            <h3>MTBF Médio</h3>
            <p style="color: #117a8b">${mtbf} <span style="font-size: 13px; font-weight: normal; color: #666;">h</span></p>
        </div>
    `;

    const coresBase = ['#155724', '#004085', '#d39e00', '#6c757d', '#dc3545', '#17a2b8', '#343a40', '#28a745'];

    const statusPorMes = getStatusPorMes(filteredData);
    const statusLabels = statusPorMes.map(formatarMesEmissao);
    const ctxStatus = document.getElementById('osmcChart').getContext('2d');
    
    if (osmcChartInstance) {
        osmcChartInstance.data.labels = statusLabels;
        osmcChartInstance.data.datasets[0].data = statusPorMes.map(mes => mes.pendentes + mes.resolvidas);
        osmcChartInstance.data.datasets[1].data = statusPorMes.map(mes => mes.resolvidas);
        osmcChartInstance.data.datasets[2].data = statusPorMes.map(mes => mes.pendentes);
        osmcChartInstance.update();
    } else {
        osmcChartInstance = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: statusLabels,
                datasets: [
                    { label: 'Total', data: statusPorMes.map(mes => mes.pendentes + mes.resolvidas), backgroundColor: '#004085' },
                    { label: 'Resolvidas', data: statusPorMes.map(mes => mes.resolvidas), backgroundColor: '#155724' },
                    { label: 'Pendentes', data: statusPorMes.map(mes => mes.pendentes), backgroundColor: '#dc3545' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' }, datalabels: { color: '#444', anchor: 'end', align: 'end', font: { weight: 'bold', size: 10 } } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    const empresasSelecionadas = filterEmpresaResponsavelDropdown.getSelecionados().size > 0;
    const blocoStats = empresasSelecionadas
        ? getExecucaoMensalStats(filteredData)
        : getTopNData(filteredData, 4, 5);
    const tituloBloco = document.getElementById('blocoChartTitle');
    tituloBloco.textContent = empresasSelecionadas
        ? 'Execução Mensal (%) - Empresas Selecionadas'
        : 'Top 5 Blocos (Total de OSMC)';
    const rotuloDataset = empresasSelecionadas ? 'Execução mensal (%)' : 'Total de OSMC';
    const corDataset = empresasSelecionadas ? '#155724' : '#004085';
    const formatarValorBloco = valor => empresasSelecionadas ? `${valor}%` : valor;
    const ctxBloco = document.getElementById('blocoChart').getContext('2d');
    
    if (blocoChartInstance) {
        blocoChartInstance.data.labels = blocoStats.labels;
        blocoChartInstance.data.datasets[0].data = blocoStats.data;
        blocoChartInstance.data.datasets[0].label = rotuloDataset;
        blocoChartInstance.data.datasets[0].backgroundColor = corDataset;
        blocoChartInstance.options.plugins.datalabels.formatter = formatarValorBloco;
        blocoChartInstance.options.scales.y.max = empresasSelecionadas ? 100 : undefined;
        blocoChartInstance.options.scales.y.ticks.callback = formatarValorBloco;
        blocoChartInstance.update();
    } else {
        blocoChartInstance = new Chart(ctxBloco, {
            type: 'bar',
            data: { labels: blocoStats.labels, datasets: [{ label: rotuloDataset, data: blocoStats.data, backgroundColor: corDataset }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                layout: { padding: { top: 25 } }, 
                plugins: { 
                    legend: { display: false }, 
                    datalabels: { color: '#444', anchor: 'end', align: 'end', offset: 4, font: { weight: 'bold', size: 11 }, formatter: formatarValorBloco } 
                }, 
                scales: { y: { beginAtZero: true, max: empresasSelecionadas ? 100 : undefined, ticks: { callback: formatarValorBloco } } } 
            }
        });
    }

    const plantaStats = getExecucaoPorPlantaStats(filteredData);
    const formatarValorPlanta = valor => `${valor}%`;
    const ctxPlanta = document.getElementById('plantaChart').getContext('2d');
    
    if (plantaChartInstance) {
        plantaChartInstance.data.labels = plantaStats.labels;
        plantaChartInstance.data.datasets[0].data = plantaStats.data;
        plantaChartInstance.options.plugins.datalabels.formatter = formatarValorPlanta;
        plantaChartInstance.update();
    } else {
        plantaChartInstance = new Chart(ctxPlanta, {
            type: 'bar',
            data: { labels: plantaStats.labels, datasets: [{ label: 'Execução (%)', data: plantaStats.data, backgroundColor: coresBase.slice(1), borderWidth: 1 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: false },
                    datalabels: { color: '#444444', anchor: 'end', align: 'end', offset: 4, font: { weight: 'bold', size: 11 }, formatter: formatarValorPlanta }
                },
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: formatarValorPlanta } } }
            }
        });
    }
}

function renderTableHeaders() {
    tableHead.innerHTML = '';
    const tr = document.createElement('tr');
    COLUNAS_DESEJADAS.forEach(colName => {
        const th = document.createElement('th');
        th.textContent = colName;
        tr.appendChild(th);
    });
    tableHead.appendChild(tr);
}

function renderTableBody() {
    tableBody.innerHTML = '';
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = filteredData.slice(startIndex, endIndex);

    paginatedItems.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach((cellValue, i) => {
            const td = document.createElement('td');
            let val = cellValue ? cellValue.toString().trim() : '-';

            if (i === 0) {
                let cleanVal = val.replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim();
                let valMin = cleanVal.toLowerCase();

                if (valMin.includes('resolvido') || valMin.includes('concluído') || valMin.includes('concluido') || valMin.includes('aprovado')) {
                    td.innerHTML = `<span style="background-color: #d4edda; color: #155724; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">✅ ${cleanVal}</span>`;
                } else if (valMin.includes('pendente') || valMin.includes('aguardando')) {
                    td.innerHTML = `<span style="background-color: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">⚠️ ${cleanVal}</span>`;
                } else if (valMin.includes('parado')) {
                    td.innerHTML = `<span style="background-color: #e2e3e5; color: #383d41; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">⏸️ ${cleanVal}</span>`;
                } else if (valMin.includes('cancelado')) {
                    td.innerHTML = `<span style="background-color: #f8d7da; color: #721c24; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">❌ ${cleanVal}</span>`;
                } else if (valMin.includes('execução') || valMin.includes('execucao')) {
                    td.innerHTML = `<span style="background-color: #cce5ff; color: #004085; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">⚙️ ${cleanVal}</span>`;
                } else {
                    td.innerHTML = `<span style="background-color: #f8f9fa; color: #212529; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">📋 ${cleanVal}</span>`;
                }
            } else if (i === 13 || i === 14) {
                if (val !== '-') {
                    td.innerHTML = `<strong>${val}</strong> <span style="font-size: 11px; color: #777;">h</span>`;
                } else {
                    td.innerHTML = `<span style="color: #999;">-</span>`;
                }
            } else {
                td.textContent = val;
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    currentPageIndicator.textContent = currentPage;
    pageInfo.textContent = `Mostrando ${filteredData.length} registros (Página ${currentPage} de ${totalPages || 1})`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || totalPages === 0;
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTableBody();
        updatePagination();
    }
}

function jumpToPage() {
    const page = parseInt(jumpInput.value);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTableBody();
        updatePagination();
        jumpInput.value = ''; 
    } else {
        alert(`Por favor, digite uma página válida entre 1 e ${totalPages}`);
    }
}

btnPrev.addEventListener('click', () => changePage(-1));
btnNext.addEventListener('click', () => changePage(1));
btnJump.addEventListener('click', jumpToPage);
jumpInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') jumpToPage(); });

let equipamentoSalaDebounceId = null;
filterEquipamentoSala.addEventListener('input', () => {
    clearTimeout(equipamentoSalaDebounceId);
    equipamentoSalaDebounceId = setTimeout(aplicarFiltrosGerais, 300);
});

filterAnoEmissao.addEventListener('change', () => {
    popularFiltrosDinamicos();
    aplicarFiltrosGerais();
});
filterPlanta.addEventListener('change', aplicarFiltrosGerais); 
filterBloco.addEventListener('change', aplicarFiltrosGerais);
btnPdfReport.addEventListener('click', gerarRelatorioPdfMensal);

document.addEventListener('DOMContentLoaded', init);