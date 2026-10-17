const CSV_URL = "https://docs.google.com/spreadsheets/d/1IGkI1foAYcKUYWSF2jknjaqhrDwXHAuJJ_984qGwSJQ/export?format=csv&gid=1142490697";

const COLUNAS_DESEJADAS = [
    "Status", "Data/hora de Emissão", "Número da OSMC", "Solicitante", "Bloco", "Piso",
    "Equipamento", "Sala", "Descrição do Problema", "Observação", "Motivo", "Data/hora de fechamento",
    "MTTR (h)", "MTBF (h)", "Empresa Responsável", "Disciplina", "Sistema"
];

let allData = [];
let filteredData = [];
const rowsPerPage = 50; 
let currentPage = 1;

let osmcChartInstance = null; 
let blocoChartInstance = null;

let isTableVisible = false;

const filterEquipamentoSala = document.getElementById('filterEquipamentoSala');
const filterAnoEmissao = document.getElementById('filterAnoEmissao');
const filterTipoPeriodo = document.getElementById('filterTipoPeriodo');
const btnRefresh = document.getElementById('btnRefresh');
const btnPdfReport = document.getElementById('btnPdfReport');
const reportType = document.getElementById('reportType');
const reportEquipamento = document.getElementById('reportEquipamento');
const reportEquipamentoOptions = document.getElementById('reportEquipamentoOptions');

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
const filterEmpresaResponsavelDropdown = new MultiSelectDropdown(
    'filterEmpresaResponsavel',
    'Todas as Empresas Responsáveis',
    () => {
        atualizarFiltrosRelacionadosEmpresa();
        aplicarFiltrosGerais();
    }
);
const filterDisciplina = new MultiSelectDropdown('filterDisciplina', 'Todas as Disciplinas', () => aplicarFiltrosGerais());
const filterSistema = new MultiSelectDropdown('filterSistema', 'Todos os Sistemas', () => aplicarFiltrosGerais());
const filterBloco = new MultiSelectDropdown('filterBloco', 'Todos os Blocos', () => aplicarFiltrosGerais());
const filterMesEmissaoDropdown = new MultiSelectDropdown('filterMesEmissao', 'Todos os períodos', () => aplicarFiltrosGerais());

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
        row[12] = mttrIndividual;

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
            row[13] = '-';
        }
    });

    equipamentosMap.forEach((ocorrencias) => {
        ocorrencias.sort((a, b) => a.dataEmissao - b.dataEmissao);

        ocorrencias.forEach((item, i) => {
            if (i === 0) {
                dados[item.index][13] = '-';
            } else {
                const anterior = ocorrencias[i - 1];
                const pontoPartida = (anterior.dataFechamento && anterior.dataFechamento <= item.dataEmissao)
                    ? anterior.dataFechamento
                    : anterior.dataEmissao;

                const diffHoras = (item.dataEmissao - pontoPartida) / (1000 * 60 * 60);
                dados[item.index][13] = diffHoras >= 0 ? diffHoras.toFixed(1) : '-';
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
            const colunasBase = COLUNAS_DESEJADAS.slice(0, 12);
            let colIndices = colunasBase.map(colName => {
                let index = headerRow.findIndex(h => h && h.trim().toLowerCase() === colName.toLowerCase());
                if (index === -1) index = headerRow.findIndex(h => h && h.toLowerCase().includes(colName.toLowerCase()));
                if (index === -1 && colName === "Status") {
                    index = headerRow.findIndex(h => h && (h.toLowerCase().includes("pendente") || h.toLowerCase().includes("situação") || h.toLowerCase().includes("status")));
                }
                return index;
            });

            const statusIdx = colIndices[0];
            const tagIdx = headerRow.findIndex(h => h && (
                /\btag\b/i.test(h) ||
                /identifica[cç][aã]o do equipamento/i.test(h)
            ));
            let empresaResponsavelIdx = headerRow.findIndex(h => h &&
                h.trim().toLowerCase().includes('empresa responsável'));
            if (empresaResponsavelIdx === -1) {
                empresaResponsavelIdx = headerRow.findIndex(h => h && h.trim().toLowerCase().includes('empresa'));
            }
            const disciplinaIdx = headerRow.findIndex(h => h && h.trim().toLowerCase().includes('disciplina'));
            const sistemaIdx = headerRow.findIndex(h => h && h.trim().toLowerCase().includes('sistema'));
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
                    newRow[12] = "-";
                    newRow[13] = "-";
                    newRow.empresaResponsavel = empresaResponsavelIdx !== -1 && row[empresaResponsavelIdx] ?
                        row[empresaResponsavelIdx].toString().trim() : "-";
                    newRow.disciplina = disciplinaIdx !== -1 && row[disciplinaIdx] ?
                        row[disciplinaIdx].toString().trim() : "-";
                    newRow.sistema = sistemaIdx !== -1 && row[sistemaIdx] ?
                        row[sistemaIdx].toString().trim() : "-";
                    newRow[14] = newRow.empresaResponsavel;
                    newRow[15] = newRow.disciplina;
                    newRow[16] = newRow.sistema;
                    newRow.tag = tagIdx !== -1 && row[tagIdx] ?
                        row[tagIdx].toString().trim() : "-";
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
    const periodosEmissao = new Map();
    const anosEmissao = new Set();
    const blocoSet = new Set();
    const equipamentoSet = new Set();

    allData.forEach(row => {
        let cleanStatus = row[0] !== "-" ? row[0].replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : "-";
        
        if (cleanStatus !== "-") statusSet.add(cleanStatus); 
        if (row.empresaResponsavel !== "-") empresaResponsavelSet.add(row.empresaResponsavel);
        const mesEmissao = getMesEmissao(row[1]);
        if (mesEmissao) {
            anosEmissao.add(String(mesEmissao.ano));
        }
        const periodoEmissao = getPeriodoEmissao(row[1], filterTipoPeriodo.value);
        if (periodoEmissao) periodosEmissao.set(periodoEmissao.chave, periodoEmissao);
        if (row[4] !== "-") blocoSet.add(row[4]);
        if (row[6] && row[6] !== "-") equipamentoSet.add(row[6]);
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
    atualizarFiltrosRelacionadosEmpresa();
    const descricoesPeriodo = {
        dia: 'Todos os dias',
        semana: 'Todas as semanas',
        mes: 'Todos os meses',
        trimestre: 'Todos os trimestres',
        semestre: 'Todos os semestres'
    };
    filterMesEmissaoDropdown.textoPadrao = descricoesPeriodo[filterTipoPeriodo.value];
    filterMesEmissaoDropdown.preencher(Array.from(periodosEmissao.values())
        .filter(periodo => !filterAnoEmissao.value || String(periodo.ano) === filterAnoEmissao.value)
        .sort((a, b) => a.chave.localeCompare(b.chave))
        .map(periodo => ({ value: periodo.chave, label: periodo.label })));
    reportEquipamentoOptions.replaceChildren();
    Array.from(equipamentoSet).sort().forEach(equipamento => {
        const option = document.createElement('option');
        option.value = equipamento;
        reportEquipamentoOptions.appendChild(option);
    });
}

function atualizarFiltrosRelacionadosEmpresa() {
    const empresasSelecionadas = filterEmpresaResponsavelDropdown.getSelecionados();
    const dadosEmpresa = allData.filter(row =>
        empresasSelecionadas.size === 0 || empresasSelecionadas.has(row.empresaResponsavel)
    );
    const disciplinas = new Set();
    const sistemas = new Set();
    const blocos = new Set();

    dadosEmpresa.forEach(row => {
        if (row.disciplina && row.disciplina !== '-') disciplinas.add(row.disciplina);
        if (row.sistema && row.sistema !== '-') sistemas.add(row.sistema);
        if (row[4] && row[4] !== '-') blocos.add(row[4]);
    });

    filterDisciplina.preencher(
        Array.from(disciplinas).sort().map(valor => ({ value: valor, label: valor }))
    );
    filterSistema.preencher(
        Array.from(sistemas).sort().map(valor => ({ value: valor, label: valor }))
    );

    filterBloco.preencher(
        Array.from(blocos).sort().map(valor => ({ value: valor, label: valor }))
    );
}

function aplicarFiltrosGerais() {
    const statusFiltro = filterStatusDropdown.getSelecionados();
    const empresaResponsavelFiltro = filterEmpresaResponsavelDropdown.getSelecionados();
    const disciplinaFiltro = filterDisciplina.getSelecionados();
    const sistemaFiltro = filterSistema.getSelecionados();
    const anoEmissaoFiltro = filterAnoEmissao.value;
    const periodosEmissaoFiltro = filterMesEmissaoDropdown.getSelecionados();
    const tipoPeriodoFiltro = filterTipoPeriodo.value;
    const blocoFiltro = filterBloco.getSelecionados();
    const buscaFiltro = filterEquipamentoSala.value.trim().toLowerCase();

    filteredData = allData.filter(row => {
        let cleanStatus = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';

        const passouStatus = statusFiltro.size === 0 || statusFiltro.has(cleanStatus);
        const passouEmpresaResponsavel = empresaResponsavelFiltro.size === 0 ||
            empresaResponsavelFiltro.has(row.empresaResponsavel);
        const passouDisciplina = disciplinaFiltro.size === 0 || disciplinaFiltro.has(row.disciplina);
        const passouSistema = sistemaFiltro.size === 0 || sistemaFiltro.has(row.sistema);
        const mesEmissao = getMesEmissao(row[1]);
        const passouAnoEmissao = !anoEmissaoFiltro || (mesEmissao && String(mesEmissao.ano) === anoEmissaoFiltro);
        const periodoEmissao = getPeriodoEmissao(row[1], tipoPeriodoFiltro);
        const passouPeriodoEmissao = periodosEmissaoFiltro.size === 0 ||
            (periodoEmissao && periodosEmissaoFiltro.has(periodoEmissao.chave));
        const passouBloco = blocoFiltro.size === 0 || blocoFiltro.has(row[4]);

        const tagVal = row.tag && row.tag !== '-' ? row.tag.toString().toLowerCase() : '';
        const equipamentoVal = row[6] ? row[6].toString().toLowerCase() : '';
        const salaVal = row[7] ? row[7].toString().toLowerCase() : '';
        const passouBusca = !buscaFiltro ||
            tagVal.includes(buscaFiltro) ||
            equipamentoVal.includes(buscaFiltro) || 
            salaVal.includes(buscaFiltro);

        return passouStatus && passouEmpresaResponsavel && passouDisciplina && passouSistema &&
            passouAnoEmissao && passouPeriodoEmissao &&
            passouBloco && passouBusca;
    });

    currentPage = 1;
    renderTableBody();
    updatePagination();
    
    atualizarDashboards(); 
}

function getPercentualStatusPorGrupo(dataArray, obterGrupo, topN = Infinity) {
    const dadosPorGrupo = new Map();

    dataArray.forEach(row => {
        const grupo = obterGrupo(row);
        if (!grupo || grupo === '-' || grupo.toLowerCase() === 'n/a') return;

        if (!dadosPorGrupo.has(grupo)) {
            dadosPorGrupo.set(grupo, { total: 0, resolvidas: 0, pendentes: 0 });
        }

        const dadosGrupo = dadosPorGrupo.get(grupo);
        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        dadosGrupo.total++;
        if (isStatusResolvido(status)) dadosGrupo.resolvidas++;
        else dadosGrupo.pendentes++;
    });

    const grupos = Array.from(dadosPorGrupo.entries())
        .map(([label, dados]) => ({
            label,
            ...dados,
            percentualResolvidas: Math.round((dados.resolvidas / dados.total) * 1000) / 10,
            percentualPendentes: Math.round((dados.pendentes / dados.total) * 1000) / 10
        }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'))
        .slice(0, topN);

    return {
        labels: grupos.map(grupo => grupo.label),
        resolvidas: grupos.map(grupo => grupo.percentualResolvidas),
        pendentes: grupos.map(grupo => grupo.percentualPendentes)
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

function formatarDataPeriodo(data) {
    return data.toLocaleDateString('pt-BR');
}

function getPeriodoEmissao(dataEmissao, tipoPeriodo) {
    const dataIsoSemHorario = typeof dataEmissao === 'string'
        ? dataEmissao.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
        : null;
    const data = dataIsoSemHorario
        ? new Date(Number(dataIsoSemHorario[1]), Number(dataIsoSemHorario[2]) - 1, Number(dataIsoSemHorario[3]))
        : parseDataHora(dataEmissao);
    if (!data) return null;

    const ano = data.getFullYear();
    if (tipoPeriodo === 'dia') {
        const chave = `${ano}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        return { chave, ano, label: formatarDataPeriodo(data) };
    }
    if (tipoPeriodo === 'semana') {
        const inicio = new Date(ano, data.getMonth(), data.getDate());
        inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + 6);
        const chave = `semana-${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
        return { chave, ano, label: `Semana ${formatarDataPeriodo(inicio)} a ${formatarDataPeriodo(fim)}` };
    }
    if (tipoPeriodo === 'mes') {
        const mes = getMesEmissao(dataEmissao);
        return mes ? { chave: mes.chave, ano: mes.ano, label: formatarMesEmissao(mes) } : null;
    }
    if (tipoPeriodo === 'trimestre') {
        const trimestre = Math.floor(data.getMonth() / 3) + 1;
        return { chave: `${ano}-T${trimestre}`, ano, label: `${trimestre}º trimestre/${ano}` };
    }
    const semestre = data.getMonth() < 6 ? 1 : 2;
    return { chave: `${ano}-S${semestre}`, ano, label: `${semestre}º semestre/${ano}` };
}

function getStatusPorPeriodo(data, tipoPeriodo) {
    const dadosPorPeriodo = new Map();

    data.forEach(row => {
        const periodo = getPeriodoEmissao(row[1], tipoPeriodo);
        if (!periodo) return;

        if (!dadosPorPeriodo.has(periodo.chave)) {
            dadosPorPeriodo.set(periodo.chave, { ...periodo, pendentes: 0, resolvidas: 0 });
        }

        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        const dadosPeriodo = dadosPorPeriodo.get(periodo.chave);
        if (isStatusResolvido(status)) {
            dadosPeriodo.resolvidas++;
        } else {
            dadosPeriodo.pendentes++;
        }
    });

    return Array.from(dadosPorPeriodo.values()).sort((a, b) => a.chave.localeCompare(b.chave));
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

    const mttrHoras = Number(mttr);
    const mtbfHoras = Number(mtbf);
    const disponibilidade = mtbfHoras + mttrHoras > 0
        ? (mtbfHoras / (mtbfHoras + mttrHoras) * 100).toFixed(1)
        : '-';

    return {
        mttr,
        mtbf,
        disponibilidade,
        totalFalhas,
        periodoTotalHoras: totalFalhas > 0 && menorDataEmissao && maiorData && maiorData > menorDataEmissao
            ? (maiorData - menorDataEmissao) / (1000 * 60 * 60)
            : 0,
        tempoOperacionalHoras: totalFalhas > 0 && menorDataEmissao && maiorData && maiorData > menorDataEmissao
            ? Math.max(0, (maiorData - menorDataEmissao) / (1000 * 60 * 60) - tempoReparacaoTotalHoras)
            : 0,
        tempoReparacaoTotalHoras,
        ordensFechadasComData
    };
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
    const equipamentoSelecionado = reportEquipamento.value.trim();

    // Filtra pelo tipo de relatório e pelo equipamento informado
    let registrosRelatorio = filteredData.filter(row => {
        const status = row[0] ? row[0].toString().replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim() : '';
        const passouStatus = !somentePendencias || !isStatusResolvido(status);
        const equipamentoRow = row[6] ? row[6].toString().trim() : '';
        const passouEquipamento = !equipamentoSelecionado ||
            equipamentoRow.toLowerCase().includes(equipamentoSelecionado.toLowerCase());
        return passouStatus && passouEquipamento;
    });

    const tipoPeriodoFiltro = filterTipoPeriodo.value;
    const periodos = getStatusPorPeriodo(registrosRelatorio, tipoPeriodoFiltro);
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
    const periodosPorPagina = 6;
    const resumirFiltro = (selecionados, padrao) => {
        const valores = Array.from(selecionados);
        if (valores.length === 0) return padrao;
        return valores.length <= 2 ? valores.join(', ') : `${valores.length} selecionados`;
    };
    const resumoEmpresa = resumirFiltro(
        filterEmpresaResponsavelDropdown.getSelecionados(),
        'Todas'
    );
    const resumoDisciplina = resumirFiltro(filterDisciplina.getSelecionados(), 'Todas');
    const resumoSistema = resumirFiltro(filterSistema.getSelecionados(), 'Todos');
    pdf.setFontSize(7);
    const linhasResumoFiltros = pdf.splitTextToSize(
        `Empresa: ${resumoEmpresa} | Disciplina: ${resumoDisciplina} | Sistema: ${resumoSistema} | Equipamento: ${equipamentoSelecionado || 'Todos'}`,
        larguraPagina - 40
    );
    if (linhasResumoFiltros.length > 2) {
        linhasResumoFiltros[1] = `${linhasResumoFiltros[1].slice(0, -3)}...`;
        linhasResumoFiltros.length = 2;
    }
    const nomesPeriodos = {
        dia: 'diário',
        semana: 'semanal',
        mes: 'mensal',
        trimestre: 'trimestral',
        semestre: 'semestral'
    };
    const nomesDistribuicao = {
        dia: 'diária',
        semana: 'semanal',
        mes: 'mensal',
        trimestre: 'trimestral',
        semestre: 'semestral'
    };
    const periodosSelecionados = filterMesEmissaoDropdown.getSelecionados();
    const periodosDisponiveis = new Map(allData
        .map(row => getPeriodoEmissao(row[1], tipoPeriodoFiltro))
        .filter(Boolean)
        .map(periodo => [periodo.chave, periodo.label]));
    const descricoesPeriodosSelecionados = Array.from(periodosSelecionados)
        .map(chave => periodosDisponiveis.get(chave))
        .filter(Boolean);
    let descricaoFiltroPeriodo = descricoesPeriodosSelecionados.length
        ? descricoesPeriodosSelecionados.slice(0, 3).join(', ')
        : 'Todos os períodos';
    if (descricoesPeriodosSelecionados.length > 3) {
        descricaoFiltroPeriodo += ` e mais ${descricoesPeriodosSelecionados.length - 3}`;
    }
    if (filterAnoEmissao.value && !periodosSelecionados.size) {
        descricaoFiltroPeriodo += ` de ${filterAnoEmissao.value}`;
    }
    
    let tituloRelatorio = somentePendencias
        ? 'Relatório de Pendências de Manutenção Corretiva'
        : 'Relatório Completo de Manutenção Corretiva';
    
    if (equipamentoSelecionado) {
        tituloRelatorio += ` - Equipamento: ${equipamentoSelecionado}`;
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
        pdf.setFontSize(7);
        pdf.text(linhasResumoFiltros, 24, 48);
        pdf.text(`Período ${nomesPeriodos[tipoPeriodoFiltro]}: ${descricaoFiltroPeriodo}`, 24, 48 + linhasResumoFiltros.length * 3);
        pdf.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, larguraPagina - 16, 28, { align: 'right' });
        pdf.setTextColor(0);
    }

    function desenharResumoIndicadores(yTop) {
        const cards = [
            { titulo: 'TOTAL O.S.', valor: String(registrosRelatorio.length), cor: [138, 21, 27] },
            { titulo: 'RESOLVIDAS', valor: String(resolvidas), cor: [21, 87, 36] },
            { titulo: 'BACKLOG (PEND.)', valor: String(pendentes), cor: [200, 35, 51] },
            {
                titulo: 'MTTR MÉDIO',
                valor: `${metricas.mttr} h`,
                detalhe: `${metricas.tempoReparacaoTotalHoras.toFixed(1)} h reparo / ${metricas.ordensFechadasComData} OS`,
                cor: [180, 130, 0]
            },
            {
                titulo: 'MTBF MÉDIO',
                valor: `${metricas.mtbf} h`,
                detalhe: `${metricas.tempoOperacionalHoras.toFixed(1)} h operacionais / ${metricas.totalFalhas} OS`,
                cor: [17, 122, 139]
            },
            {
                titulo: 'DISPONIBILIDADE',
                valor: `${metricas.disponibilidade}${metricas.disponibilidade !== '-' ? '%' : ''}`,
                detalhe: `MTBF ÷ (MTBF + MTTR) | ${metricas.tempoOperacionalHoras.toFixed(1)} h operacionais / ${metricas.tempoReparacaoTotalHoras.toFixed(1)} h em reparo`,
                cor: [111, 66, 193]
            }
        ];

        const larguraCard = 42;
        const alturaCard = 23;
        const gap = 4;
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
            pdf.text(c.valor, x + 6, yTop + (c.detalhe ? 11 : 15));
            if (c.detalhe) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(5);
                pdf.setTextColor(100);
                pdf.text(pdf.splitTextToSize(c.detalhe, larguraCard - 9), x + 6, yTop + 16);
            }
        });
        pdf.setTextColor(0);
    }

    // PÁGINA 1: Cabeçalho, indicadores detalhados e gráfico por período
    desenharCabecalho(tituloRelatorio, `Indicadores Gerais de Desempenho e Distribuição ${nomesDistribuicao[tipoPeriodoFiltro]}`);
    desenharResumoIndicadores(59);

    const margemEsquerda = 28;
    const margemDireita = 20;
    const topoGrafico = 96;
    const baseGrafico = alturaPagina - 25;
    const alturaGrafico = baseGrafico - topoGrafico;
    const larguraGrafico = larguraPagina - margemEsquerda - margemDireita;

    const periodosExibicao = periodos.slice(0, periodosPorPagina);
    const maiorValor = Math.max(...periodosExibicao.flatMap(periodo => [periodo.pendentes, periodo.resolvidas, periodo.pendentes + periodo.resolvidas]), 1);
    const larguraGrupo = larguraGrafico / (periodosExibicao.length || 1);
    const larguraBarra = Math.min(16, larguraGrupo * 0.22);
    const espacamentoBarra = larguraBarra + 2;

    // Legenda do gráfico
    pdf.setFontSize(8.5);
    pdf.setFillColor(0, 64, 133);
    pdf.rect(margemEsquerda, 90, 4, 4, 'F');
    pdf.text('Total', margemEsquerda + 6, 93.5);
    pdf.setFillColor(21, 87, 36);
    pdf.rect(margemEsquerda + 28, 90, 4, 4, 'F');
    pdf.text('Resolvidas', margemEsquerda + 34, 93.5);
    pdf.setFillColor(220, 53, 69);
    pdf.rect(margemEsquerda + 68, 90, 4, 4, 'F');
    pdf.text('Pendentes', margemEsquerda + 74, 93.5);

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

    periodosExibicao.forEach((periodo, indice) => {
        const total = periodo.pendentes + periodo.resolvidas;
        const centroGrupo = margemEsquerda + (larguraGrupo * indice) + (larguraGrupo / 2);
        const alturaTotal = (total / maiorValor) * alturaGrafico;
        const alturaResolvida = (periodo.resolvidas / maiorValor) * alturaGrafico;
        const alturaPendente = (periodo.pendentes / maiorValor) * alturaGrafico;
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
        pdf.text(String(periodo.resolvidas), xResolvida + larguraBarra / 2, baseGrafico - alturaResolvida - 2, { align: 'center' });
        pdf.setTextColor(220, 53, 69);
        pdf.text(String(periodo.pendentes), xPendente + larguraBarra / 2, baseGrafico - alturaPendente - 2, { align: 'center' });
        pdf.setTextColor(0);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(periodo.label, centroGrupo, baseGrafico + 6, { align: 'center', maxWidth: larguraGrupo });
        pdf.setFont('helvetica', 'normal');
    });

    // PÁGINA 2 em diante: Lista Detalhada com MTTR e MTBF individuais
    const margemEsquerdaTabela = 14;
    const colunas = [
        { titulo: 'Nº OSMC', x: 14, largura: 20 },
        { titulo: 'Emissão', x: 34, largura: 18 },
        { titulo: 'Status', x: 52, largura: 23 },
        { titulo: 'Solicitante', x: 75, largura: 22 },
        { titulo: 'Equipamento', x: 97, largura: 22 },
        { titulo: 'Empresa', x: 119, largura: 21 },
        { titulo: 'Disciplina', x: 140, largura: 18 },
        { titulo: 'Sistema', x: 158, largura: 18 },
        { titulo: 'Bloco', x: 176, largura: 11 },
        { titulo: 'MTTR', x: 187, largura: 12 },
        { titulo: 'MTBF', x: 199, largura: 12 },
        { titulo: 'Descrição do problema', x: 211, largura: 40 },
        { titulo: 'Motivo', x: 251, largura: 34 }
    ];

    const yCabecalhoTabela = 61;
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
        const linhasDescricao = pdf.splitTextToSize(descricao, colunas[11].largura - 2);
        const linhasMotivo = pdf.splitTextToSize(motivo, colunas[12].largura - 2);
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
                // OSMC, emissão, status, equipamento, empresa, disciplina, sistema, bloco, MTTR e MTBF
                pdf.text(pdf.splitTextToSize(String(row[2] || '-'), colunas[0].largura - 2)[0], colunas[0].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row[1] || '-'), colunas[1].largura - 2)[0], colunas[1].x, yAtual + 5.5);

                const statusLimpo = String(row[0] || '-').replace(/⚠️|✅|⏸️|❌|⚙️|🛑/g, '').trim();
                desenharIconeStatus(pdf, statusLimpo, colunas[2].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(statusLimpo, colunas[2].largura - 6)[0], colunas[2].x + 4.5, yAtual + 5.5);

                pdf.text(pdf.splitTextToSize(String(row[3] || '-'), colunas[3].largura - 2)[0], colunas[3].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row[6] || '-'), colunas[4].largura - 2)[0], colunas[4].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row.empresaResponsavel || '-'), colunas[5].largura - 2)[0], colunas[5].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row.disciplina || '-'), colunas[6].largura - 2)[0], colunas[6].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row.sistema || '-'), colunas[7].largura - 2)[0], colunas[7].x, yAtual + 5.5);
                pdf.text(pdf.splitTextToSize(String(row[4] || '-'), colunas[8].largura - 2)[0], colunas[8].x, yAtual + 5.5);

                const mttrTexto = row[12] !== '-' ? `${row[12]} h` : '-';
                const mtbfTexto = row[13] !== '-' ? `${row[13]} h` : '-';
                pdf.text(mttrTexto, colunas[9].x, yAtual + 5.5);
                pdf.text(mtbfTexto, colunas[10].x, yAtual + 5.5);
            }

            pdf.text(descBloco, colunas[11].x, yAtual + 5.5);
            pdf.text(motBloco, colunas[12].x, yAtual + 5.5);
            yAtual += alturaLinha;
            indiceLinha++;
        }
    });

    const nomeArquivo = equipamentoSelecionado
        ? `relatorio-osmc-${equipamentoSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
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

    const {
        mttr,
        mtbf,
        disponibilidade,
        tempoOperacionalHoras,
        tempoReparacaoTotalHoras,
        periodoTotalHoras,
        totalFalhas,
        ordensFechadasComData
    } = calcularMetricasGerais(filteredData);
    const backlog = pendentes;

    kpiCardsContainer.innerHTML = `
        <div class="kpi-card" style="border-left-color: #004085;">
            <h3>Total Filtrado</h3>
            <p style="color: #004085">${filteredData.length}</p>
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
            <span class="kpi-card-detail">Tempo total de reparo ÷ O.S. resolvidas com datas<br>${tempoReparacaoTotalHoras.toFixed(1)} h ÷ ${ordensFechadasComData} O.S.</span>
        </div>
        <div class="kpi-card" style="border-left-color: #17a2b8;">
            <h3>MTBF Médio</h3>
            <p style="color: #117a8b">${mtbf} <span style="font-size: 13px; font-weight: normal; color: #666;">h</span></p>
            <span class="kpi-card-detail">Tempo operacional ÷ O.S. no filtro<br>${tempoOperacionalHoras.toFixed(1)} h ÷ ${totalFalhas} O.S. · Período: ${periodoTotalHoras.toFixed(1)} h</span>
        </div>
        <div class="kpi-card" style="border-left-color: #6f42c1;">
            <h3>Disponibilidade</h3>
            <p style="color: #6f42c1">${disponibilidade}${disponibilidade !== '-' ? '<span style="font-size: 13px; font-weight: normal; color: #666;">%</span>' : ''}</p>
            <span class="kpi-card-detail">MTBF ÷ (MTBF + MTTR)<br>${tempoOperacionalHoras.toFixed(1)} h operacionais · ${tempoReparacaoTotalHoras.toFixed(1)} h em reparo</span>
        </div>
    `;

    const empresasSelecionadas = Array.from(filterEmpresaResponsavelDropdown.getSelecionados());
    const sufixoEmpresa = empresasSelecionadas.length === 0
        ? ''
        : empresasSelecionadas.length <= 2
            ? ` · ${empresasSelecionadas.join(', ')}`
            : ` · ${empresasSelecionadas.length} empresas selecionadas`;
    document.getElementById('totalChartTitle').textContent =
        `Total, Resolvidas e Pendentes por Mês${sufixoEmpresa}`;

    const statusPorMes = getStatusPorPeriodo(filteredData, 'mes');
    const statusLabels = statusPorMes.map(periodo => periodo.label);
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
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, font: { size: 13 } } },
                    tooltip: { mode: 'index', intersect: false },
                    datalabels: { color: '#333', anchor: 'end', align: 'end', clamp: true, display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, font: { weight: 'bold', size: 12 } }
                },
                layout: { padding: { top: 24 } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 12 } } },
                    y: { beginAtZero: true, grace: '10%', ticks: { precision: 0, font: { size: 12 } } }
                }
            }
        });
    }

    const temEmpresaSelecionada = empresasSelecionadas.length > 0;
    const statusPorGrupo = temEmpresaSelecionada
        ? getPercentualStatusPorGrupo(filteredData, row => row[4])
        : getPercentualStatusPorGrupo(filteredData, row => row.empresaResponsavel, 5);
    const tituloBloco = document.getElementById('blocoChartTitle');
    tituloBloco.textContent = temEmpresaSelecionada
        ? `Percentual de Resolvidas e Pendentes por Bloco${sufixoEmpresa}`
        : 'Top 5 Empresas (% de O.S. Resolvidas)';
    const datasetsBloco = [
        {
            label: 'Resolvidas (%)',
            data: statusPorGrupo.resolvidas,
            backgroundColor: '#155724'
        }
    ];
    if (temEmpresaSelecionada) {
        datasetsBloco.push({
            label: 'Pendentes (%)',
            data: statusPorGrupo.pendentes,
            backgroundColor: '#dc3545'
        });
    }
    const formatarPercentual = valor => `${Number(valor).toFixed(1)}%`;
    const ctxBloco = document.getElementById('blocoChart').getContext('2d');
    const nBarras = statusPorGrupo.labels.length * (temEmpresaSelecionada ? 2 : 1);
    document.getElementById('blocoChart').parentElement.style.height = `${Math.max(380, nBarras * 28 + 80)}px`;
    
    if (blocoChartInstance) {
        blocoChartInstance.data.labels = statusPorGrupo.labels;
        blocoChartInstance.data.datasets = datasetsBloco;
        blocoChartInstance.options.indexAxis = 'y';
        blocoChartInstance.options.plugins.legend.display = temEmpresaSelecionada;
        blocoChartInstance.options.plugins.datalabels.formatter = formatarPercentual;
        blocoChartInstance.options.scales.x = {
            beginAtZero: true,
            max: 100,
            ticks: { callback: formatarPercentual }
        };
        delete blocoChartInstance.options.scales.y.max;
        delete blocoChartInstance.options.scales.y.ticks.callback;
        blocoChartInstance.update();
    } else {
        blocoChartInstance = new Chart(ctxBloco, {
            type: 'bar',
            data: { labels: statusPorGrupo.labels, datasets: datasetsBloco },
            options: { 
                indexAxis: 'y',
                responsive: true, 
                maintainAspectRatio: false, 
                layout: { padding: { top: 10, right: 50 } }, 
                plugins: { 
                    legend: { display: temEmpresaSelecionada, position: 'top', labels: { usePointStyle: true, font: { size: 13 } } }, 
                    datalabels: { color: '#333', anchor: 'end', align: 'end', offset: 4, clamp: true, font: { weight: 'bold', size: 12 }, formatter: formatarPercentual } 
                }, 
                scales: { x: { beginAtZero: true, max: 100, ticks: { callback: formatarPercentual } }, y: { ticks: { font: { size: 12 } } } } 
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
            } else if (i === 12 || i === 13) {
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
filterTipoPeriodo.addEventListener('change', () => {
    popularFiltrosDinamicos();
    aplicarFiltrosGerais();
});
btnPdfReport.addEventListener('click', gerarRelatorioPdfMensal);

document.addEventListener('DOMContentLoaded', init);