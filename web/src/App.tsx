import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type User = { usuario: string; papel: "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR" };
type Section = "Visão geral" | "Organizações" | "Lotes" | "Equipamentos" | "Relatórios";
type Request = (path: string, init?: RequestInit) => Promise<any>;
const allSections: Section[] = ["Visão geral", "Organizações", "Lotes", "Equipamentos", "Relatórios"];
const enums = {
  tipo: ["COMPUTADOR_MESA", "NOTEBOOK", "MONITOR", "IMPRESSORA", "SERVIDOR", "ROTEADOR", "CABO_ESTRUTURADO", "FONTE_ALIMENTACAO"],
  estado: ["NOVO", "BOM_ESTADO", "USADO_LEVE", "USADO_MODERADO", "DANIFICADO_LEVE", "DANIFICADO_GRAVE", "INSERVIVEL"],
  status: ["AGUARDANDO_TRIAGEM", "EM_TRIAGEM", "AGUARDANDO_DESMONTE", "EM_DESMONTE", "PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO", "BAIXA_DEFINITIVA"]
};

function canSee(user: User, section: Section) {
  if (section === "Visão geral") return true;
  if (section === "Organizações") return ["ADMINISTRADOR", "OPERADOR_CADASTRO"].includes(user.papel);
  if (section === "Lotes") return ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO"].includes(user.papel);
  if (section === "Equipamentos") return true;
  return ["ADMINISTRADOR", "AUDITOR"].includes(user.papel);
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("greencode-token") ?? "");
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("greencode-user");
    return saved ? JSON.parse(saved) as User : null;
  });
  const [section, setSection] = useState<Section>("Visão geral");
  const [notice, setNotice] = useState("");
  const logout = () => { sessionStorage.removeItem("greencode-token"); sessionStorage.removeItem("greencode-user"); setToken(""); setUser(null); };
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(`/api${path}`, { ...init, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.erro ?? `Falha na solicitação (${response.status}).`;
      if (response.status === 409) throw new Error(`Conflito (409): ${message}`);
      throw new Error(message);
    }
    return body;
  }, [token]);
  useEffect(() => { if (token) void request("/health").catch((error: Error) => setNotice(error.message)); }, [request, token]);
  useEffect(() => { if (user && !canSee(user, section)) setSection("Visão geral"); }, [section, user]);
  if (!token || !user) return <Login onLogin={(accessToken, account) => {
    sessionStorage.setItem("greencode-token", accessToken); sessionStorage.setItem("greencode-user", JSON.stringify(account));
    setToken(accessToken); setUser(account); setNotice("");
  }} />;
  const sections = allSections.filter(item => canSee(user, item));
  return <div className="shell">
    <aside className="sidebar"><a className="brand" href="#inicio"><span className="brand-mark">G</span><span>green<span className="brand-light">code</span><small>LOGÍSTICA REVERSA</small></span></a>
      <div className="nav-label">PLATAFORMA</div><nav>{sections.map(item => <button key={item} className={`nav-item ${section === item ? "active" : ""}`} onClick={() => { setSection(item); setNotice(""); }}><span className="nav-icon">{["⌂", "▦", "▤", "◈", "▥"][allSections.indexOf(item)]}</span>{item}{item === "Visão geral" && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><span className="online-dot" /> API conectada <span className="version">AV2</span></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="crumb">GreenCode <span>/</span> {section}</div><div className="top-user"><span className="avatar">{user.usuario.slice(0, 1).toUpperCase()}</span><span><b>{user.usuario}</b><small>{user.papel}</small></span><button className="logout" onClick={logout} title="Sair">↗</button></div></header>
      <div className="content">{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {section === "Visão geral" ? <Dashboard request={request} user={user} /> : <DataSection key={section} section={section} request={request} user={user} onNotice={setNotice} />}
      </div><footer>GreenCode <span>•</span> Plataforma de logística reversa <span className="footer-right">Desenvolvido para AV2</span></footer>
    </main>
  </div>;
}

function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: username, senha: password }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.erro ?? "Não foi possível entrar."); onLogin(body.token, body.usuario); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao conectar à API."); } finally { setBusy(false); }
  }
  return <div className="login-page"><section className="login-art"><div className="art-brand"><span className="brand-mark">G</span> green<span>code</span></div><div className="art-copy"><span className="eyebrow">TECNOLOGIA QUE REGENERA</span><h1>O futuro é<br /><em>circular.</em></h1><p>Gestão inteligente de logística reversa para um mundo com menos resíduos e mais possibilidades.</p></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-foot">CUIDAR DO CICLO É CUIDAR DO AMANHÃ <span>↗</span></div></section>
    <section className="login-panel"><div className="login-box"><div className="login-symbol">↗</div><span className="eyebrow dark-eyebrow">ÁREA RESTRITA</span><h2>Bem-vindo</h2><p className="login-subtitle">Entre com suas credenciais para acessar a plataforma.</p><form onSubmit={submit}><label htmlFor="username">Usuário</label><input id="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button login-button" disabled={busy}>{busy ? "Entrando…" : "Entrar na plataforma"}<span>→</span></button></form><small className="secure-note">⌑ Conexão protegida por autenticação JWT</small></div><div className="login-copyright">© 2026 GreenCode <span>•</span> Logística reversa</div></section></div>;
}

function Dashboard({ request, user }: { request: Request; user: User }) {
  const [stats, setStats] = useState({ organizations: 0, lots: 0, equipment: 0 }); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const jobs: Promise<any>[] = [];
    if (["ADMINISTRADOR", "OPERADOR_CADASTRO"].includes(user.papel)) jobs.push(request("/organizacoes").then(data => setStats(value => ({ ...value, organizations: data.length }))));
    if (["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO"].includes(user.papel)) jobs.push(request(`/lotes?dataInicio=${new Date(2000, 0, 1).toISOString()}&dataFim=${new Date(2100, 0, 1).toISOString()}`).then(data => setStats(value => ({ ...value, lots: data.length }))));
    if (["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO"].includes(user.papel)) jobs.push(request("/equipamentos").then(data => setStats(value => ({ ...value, equipment: data.length }))));
    Promise.allSettled(jobs).finally(() => setLoading(false));
  }, [request, user.papel]);
  return <><div className="page-heading"><div><span className="eyebrow dark-eyebrow">PAINEL DE CONTROLE</span><h1>Visão geral</h1><p>Acompanhe a operação de logística reversa em um só lugar.</p></div><div className="today"><span className="today-icon">◷</span><span><small>HOJE</small><b>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</b></span></div></div>
    <div className="welcome-banner"><div><span className="banner-kicker">CICLO CONSCIENTE, IMPACTO POSITIVO</span><h2>Todo ciclo merece<br />um <em>novo começo.</em></h2><p>Gerencie recursos, acompanhe materiais e transforme logística em impacto.</p></div><div className="leaf-art"><span>↗</span></div><div className="banner-index">01 <i /> 03</div></div>
    <div className="section-title"><div><h2>Resumo da operação</h2><p>Indicadores disponíveis para seu perfil</p></div><span className="live-label"><i /> DADOS AO VIVO</span></div>
    <div className="stats-grid"><StatCard title="Organizações" value={stats.organizations} icon="▦" detail="parceiros cadastrados" tone="mint" loading={loading} /><StatCard title="Lotes recebidos" value={stats.lots} icon="▤" detail="lotes na plataforma" tone="sand" loading={loading} /><StatCard title="Equipamentos" value={stats.equipment} icon="◈" detail="itens rastreados" tone="blue" loading={loading} /></div>
    <div className="lower-grid"><article className="info-card"><div className="card-heading"><div><span className="eyebrow dark-eyebrow">COMO ESTAMOS</span><h3>Operação em movimento</h3></div><span className="card-icon">↗</span></div><p>Use o menu para consultar os dados e ações liberados para o seu papel.</p><div className="mini-flow"><span>COLETA</span><i>→</i><span>TRIAGEM</span><i>→</i><span>DESTINO</span></div></article><article className="info-card api-card"><div className="card-heading"><div><span className="eyebrow dark-eyebrow">SISTEMA</span><h3>Serviços disponíveis</h3></div><span className="status-pill"><i /> Online</span></div><div className="service-row"><span>API REST</span><b>Conectada</b></div><div className="service-row"><span>Autenticação</span><b>JWT ativo</b></div><div className="service-row"><span>Documentação</span><a href="/docs" target="_blank" rel="noreferrer">Abrir OpenAPI ↗</a></div></article></div>
  </>;
}
function StatCard({ title, value, icon, detail, tone, loading }: { title: string; value: number; icon: string; detail: string; tone: string; loading: boolean }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{title}</span><div className="stat-value">{loading ? "—" : value}</div><div className="stat-detail">{detail}<span>↗</span></div></article>; }

function DataSection({ section, request, user, onNotice }: { section: Section; request: Request; user: User; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<any[]>([]); const [orgs, setOrgs] = useState<any[]>([]); const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | null>(null); const [selected, setSelected] = useState<any | null>(null); const [events, setEvents] = useState<any[] | null>(null);
  const [filter, setFilter] = useState("AGUARDANDO_TRIAGEM"); const [includeCancelled, setIncludeCancelled] = useState(false); const [busy, setBusy] = useState(false);
  const status = section === "Relatórios" ? filter : "";
  const endpoint = useMemo(() => {
    if (section === "Organizações") return "/organizacoes";
    if (section === "Lotes") return `/lotes?dataInicio=${encodeURIComponent(new Date(2000, 0, 1).toISOString())}&dataFim=${encodeURIComponent(new Date(2100, 0, 1).toISOString())}&incluirCancelados=${includeCancelled}`;
    if (section === "Equipamentos" && user.papel === "AUDITOR") return `/relatorios/equipamentos?status=${encodeURIComponent(status)}`;
    if (section === "Equipamentos") return `/equipamentos?incluirCancelados=${includeCancelled}`;
    return `/relatorios/equipamentos?status=${encodeURIComponent(status)}`;
  }, [includeCancelled, section, status, user.papel]);
  const refresh = useCallback(() => {
    setLoading(true); request(endpoint).then(data => setItems(Array.isArray(data) ? data : data?.dados ?? data?.equipamentos ?? data?.lotes ?? []))
      .catch((error: Error) => onNotice(error.message)).finally(() => setLoading(false));
  }, [endpoint, onNotice, request]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if ((section === "Lotes" && user.papel !== "GESTOR_ALMOXARIFADO") || (section === "Equipamentos" && user.papel !== "AUDITOR")) void request("/organizacoes").then(setOrgs).catch(() => setOrgs([]));
    if (section === "Equipamentos") void request(`/lotes?dataInicio=${new Date(2000, 0, 1).toISOString()}&dataFim=${new Date(2100, 0, 1).toISOString()}`).then(setLots).catch(() => setLots([]));
  }, [request, section, user.papel]);

  const canMutate = user.papel !== "AUDITOR";
  const canTrace = ["AUDITOR", "GESTOR_ALMOXARIFADO"].includes(user.papel);
  const showActionColumn = section === "Organizações" || section === "Lotes" || section === "Equipamentos";
  const openCreate = () => { setForm({}); setEditing(null); setFormOpen(true); setSelected(null); };
  const openEdit = (item: any, initial: Record<string, string>) => { setEditing(item); setForm(initial); setFormOpen(true); setSelected(null); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      if (section === "Organizações" && !editing) {
        const contractFields = ["dataAssinatura", "dataVencimento", "valorMensal", "clausulas"];
        if (contractFields.some(key => Boolean(form[key])) && contractFields.some(key => !form[key]?.trim())) {
          throw new Error("Para cadastrar o contrato junto com a organização, preencha assinatura, vencimento, valor e cláusulas.");
        }
      }
      if (section === "Equipamentos" && !editing && !lots.some(lot => lot.id === form.loteId)) {
        throw new Error("Selecione um lote ativo e recarregue a lista antes de cadastrar o equipamento.");
      }
      const payload = toPayload(section, form, editing, lots);
      const path = section === "Organizações" ? `/organizacoes${editing ? `/${editing.id}` : ""}` : section === "Lotes" ? `/lotes${editing ? `/${editing.id}` : ""}` : `/equipamentos${editing ? `/${editing.id}` : ""}`;
      await request(path, { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      closeForm(); onNotice(editing ? "Alterações salvas." : "Registro criado com sucesso."); refresh();
      if (section === "Equipamentos" && !editing) {
        const updatedLots = await request(`/lotes?dataInicio=${new Date(2000, 0, 1).toISOString()}&dataFim=${new Date(2100, 0, 1).toISOString()}`);
        setLots(updatedLots);
      }
    } catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function cancelRecord(item: any, kind: "lote" | "equipamento" | "organizacao") {
    if (kind === "organizacao") {
      if (!window.confirm(`Desativar a organização ${item.razaoSocial}?`)) return;
      try { await request(`/organizacoes/${item.id}?version=${item.version}`, { method: "DELETE" }); onNotice("Organização desativada."); refresh(); }
      catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível desativar."); }
      return;
    }
    const motivo = window.prompt("Motivo do cancelamento:");
    if (!motivo?.trim()) return;
    const path = kind === "lote" ? `/lotes/${item.id}` : `/equipamentos/${item.id}`;
    try { await request(path, { method: "DELETE", body: JSON.stringify({ version: item.version, motivo }) }); onNotice("Registro cancelado, com histórico preservado."); refresh(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível cancelar."); }
  }
  async function runAction(path: string, method: string, body: unknown, success: string) {
    setBusy(true); try { await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); onNotice(success); setSelected(null); refresh(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }
  async function showMovements(item: any) {
    try { setEvents(await request(`/equipamentos/${item.id}/movimentacoes`)); setSelected(item); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível consultar o histórico."); }
  }
  async function showContracts(item: any) {
    try { const contratos = await request(`/organizacoes/${item.id}/contratos`); setSelected({ ...item, contratos }); setEvents(null); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível consultar os contratos."); }
  }
  async function showLot(item: any) {
    try { const lote = await request(`/lotes/${item.id}`); setSelected({ kind: "lote", lote }); setEvents(null); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível consultar o lote."); }
  }
  const heading = section === "Relatórios" ? "Relatórios de equipamentos" : section;
  const columns = section === "Organizações" ? [{ key: "razaoSocial", label: "Organização" }, { key: "cnpj", label: "CNPJ" }, { key: "email", label: "E-mail" }, { key: "contratoVigente", label: "Contrato" }]
    : section === "Lotes" ? [{ key: "notaFiscal", label: "Nota fiscal" }, { key: "dataEntrada", label: "Entrada" }, { key: "organizacao", label: "Organização" }, { key: "equipamentos", label: "Equipamentos" }]
      : [{ key: "codigoBarrasInterno", label: "Código" }, { key: "tipo", label: "Tipo" }, { key: "marca", label: "Marca" }, { key: "estadoFisico", label: "Estado físico" }, { key: "statusRastreamento", label: "Status" }];
  return <><div className="page-heading"><div><span className="eyebrow dark-eyebrow">GESTÃO OPERACIONAL</span><h1>{heading}</h1><p>{section === "Relatórios" ? "Consulte os equipamentos por status de rastreamento." : `Consulte e gerencie ${section.toLowerCase()} disponíveis para seu perfil.`}</p></div>{canMutate && section !== "Relatórios" && <button className="primary-button create-button" onClick={() => formOpen ? closeForm() : openCreate()}>{formOpen ? "Fechar formulário" : `+ Novo ${section === "Organizações" ? "organização" : section === "Lotes" ? "lote" : "equipamento"}`}</button>}</div>
    {(section === "Relatórios" || (section === "Equipamentos" && user.papel === "AUDITOR")) && <div className="toolbar"><label htmlFor="status-filter">Status de rastreamento</label><select id="status-filter" value={filter} onChange={event => setFilter(event.target.value)}>{enums.status.map(value => <option key={value} value={value}>{labelEnum(value)}</option>)}</select><button className="secondary-button" onClick={refresh}>Consultar</button></div>}
    {(section === "Lotes" || section === "Equipamentos") && user.papel !== "AUDITOR" && <div className="toolbar"><label><input type="checkbox" checked={includeCancelled} onChange={event => setIncludeCancelled(event.target.checked)} /> Incluir cancelados</label></div>}
    {formOpen && <EntityForm section={section} form={form} setForm={setForm} orgs={orgs} lots={lots} editing={editing} busy={busy} user={user} onSubmit={save} onCancel={closeForm} />}
    {selected && section === "Organizações" && <ContractPanel organization={selected} request={request} user={user} onNotice={onNotice} onClose={() => setSelected(null)} onRefresh={refresh} />}
    {selected?.kind === "lote" && <div className="editor-card"><div className="table-heading"><div><h2>Lote · {selected.lote.notaFiscal}</h2><p>{selected.lote.equipamentos.length} equipamento(s) · versão {selected.lote.version}</p></div><button className="icon-button" onClick={() => setSelected(null)}>Fechar</button></div><div className="table-scroll"><table><thead><tr><th>Código</th><th>Tipo</th><th>Marca / modelo</th><th>Estado</th><th>Rastreamento</th></tr></thead><tbody>{selected.lote.equipamentos.map((equipment: any) => <tr key={equipment.id}><td>{equipment.codigoBarrasInterno}</td><td>{labelEnum(equipment.tipo)}</td><td>{equipment.marca} {equipment.modelo}</td><td>{labelEnum(equipment.estadoFisico)}</td><td>{labelEnum(equipment.statusRastreamento)}</td></tr>)}</tbody></table></div></div>}
    {selected && events && <div className="editor-card"><div className="table-heading"><div><h2>Rastreabilidade · {selected.codigoBarrasInterno}</h2><p>{events.length} evento(s) registrado(s)</p></div><button className="icon-button" onClick={() => { setSelected(null); setEvents(null); }}>Fechar</button></div><EventList events={events} /></div>}
    {loading ? <div className="table-card empty-state">Carregando dados…</div> : <div className="table-card"><div className="table-heading"><div><h2>{section === "Relatórios" ? "Resultados" : "Registros"}</h2><p>{items.length} resultado(s)</p></div><button className="icon-button" onClick={refresh} title="Atualizar">↻</button></div>{items.length === 0 ? <div className="empty-state"><span>◇</span><b>Nenhum registro encontrado</b><small>Quando houver dados cadastrados, eles aparecerão aqui.</small></div> : <div className="table-scroll"><table><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}{showActionColumn && <th>Ações</th>}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id ?? index}>{columns.map(col => <td key={col.key}>{renderValue(item, col.key)}</td>)}{showActionColumn && <td className="actions-cell">{section === "Organizações" && <><button className="text-button" onClick={() => showContracts(item)}>Contratos</button>{canMutate && item.ativo && <><button className="text-button" onClick={() => openEdit(item, { razaoSocial: item.razaoSocial, cnpj: item.cnpj, inscricaoEstadual: item.inscricaoEstadual ?? "", enderecoCompleto: item.enderecoCompleto, telefone: item.telefone, email: item.email })}>Editar</button><button className="text-button danger" onClick={() => cancelRecord(item, "organizacao")}>Desativar</button></>}</>}
      {section === "Lotes" && <><button className="text-button" onClick={() => showLot(item)}>Equipamentos</button>{canMutate && !item.canceladoEm && item.statusProcessamento === "RECEBIDO" && <><button className="text-button" onClick={() => openEdit(item, { dataEntrada: toDateInput(item.dataEntrada), notaFiscal: item.notaFiscal, transportadora: item.transportadora, observacoes: item.observacoes ?? "" })}>Editar</button><button className="text-button danger" onClick={() => cancelRecord(item, "lote")}>Cancelar</button><button className="text-button" onClick={() => runAction(`/lotes/${item.id}/triagem`, "PATCH", { version: item.version }, "Triagem do lote concluída.")}>Concluir triagem</button></>}</>}
      {section === "Equipamentos" && <>{canMutate && !item.canceladoEm && <><button className="text-button" onClick={() => openEdit(item, { marca: item.marca, modelo: item.modelo, anoFabricacao: String(item.anoFabricacao), pesoQuilogramas: String(item.pesoQuilogramas) })}>Editar</button><button className="text-button danger" onClick={() => cancelRecord(item, "equipamento")}>Cancelar</button>{item.statusRastreamento === "AGUARDANDO_TRIAGEM" && <button className="text-button" onClick={() => runAction(`/equipamentos/${item.id}/triagem`, "POST", { version: item.version }, "Triagem concluída.")}>Concluir triagem</button>}</>}{canTrace && <button className="text-button" onClick={() => showMovements(item)}>Rastreabilidade</button>}</>}
      </td>}</tr>)}</tbody></table></div>}</div>}
  </>;
}

function EntityForm({ section, form, setForm, orgs, lots, editing, busy, user, onSubmit, onCancel }: { section: Section; form: Record<string, string>; setForm: (value: Record<string, string>) => void; orgs: any[]; lots: any[]; editing: any | null; busy: boolean; user: User; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  const set = (key: string, value: string) => setForm({ ...form, [key]: value });
  const input = (key: string, label: string, type = "text", required = true, hint?: string) => <label key={key}>{label}<input type={type} required={required} step={type === "number" ? "any" : undefined} value={form[key] ?? ""} onChange={event => set(key, event.target.value)} />{hint && <small>{hint}</small>}</label>;
  const select = (key: string, label: string, values: string[], required = true) => <label key={key}>{label}<select required={required} value={form[key] ?? ""} onChange={event => set(key, event.target.value)}><option value="">Selecione…</option>{values.map(value => <option key={value} value={value}>{labelEnum(value)}</option>)}</select></label>;
  let fields: ReactNode[] = [];
  if (section === "Organizações") fields = [input("razaoSocial", "Razão social"), input("cnpj", "CNPJ", "text", true, "14 dígitos ou formato pontuado"), input("inscricaoEstadual", "Inscrição estadual", "text", false), input("enderecoCompleto", "Endereço completo"), input("telefone", "Telefone"), input("email", "E-mail", "email")];
  if (section === "Lotes") fields = [!editing && (user.papel === "GESTOR_ALMOXARIFADO" ? input("organizacaoId", "ID da organização (UUID)") : <label key="organizacaoId">Organização<select required value={form.organizacaoId ?? ""} onChange={event => set("organizacaoId", event.target.value)}><option value="">Selecione…</option>{orgs.map(org => <option key={org.id} value={org.id}>{org.razaoSocial} · {org.cnpj}</option>)}</select></label>), input("notaFiscal", "Nota fiscal"), input("transportadora", "Transportadora"), input("dataEntrada", "Data de entrada", "date", false), <label key="observacoes">Observações<textarea value={form.observacoes ?? ""} onChange={event => set("observacoes", event.target.value)} /></label>];
  if (section === "Equipamentos" && editing) fields = [input("marca", "Marca"), input("modelo", "Modelo"), input("anoFabricacao", "Ano de fabricação", "number"), input("pesoQuilogramas", "Peso (kg)", "number")];
  if (section === "Equipamentos" && !editing) fields = [input("codigoBarrasInterno", "Código de barras"), select("tipo", "Tipo", enums.tipo), input("marca", "Marca"), input("modelo", "Modelo"), input("anoFabricacao", "Ano de fabricação", "number"), select("estadoFisico", "Estado físico", enums.estado), input("pesoQuilogramas", "Peso (kg)", "number"), <label key="loteId">Lote<select required value={form.loteId ?? ""} onChange={event => set("loteId", event.target.value)}><option value="">Selecione…</option>{lots.filter(lot => !lot.canceladoEm).map(lot => <option key={lot.id} value={lot.id}>{lot.notaFiscal} · v{lot.version}</option>)}</select></label>, input("posicaoNoLote", "Posição no lote", "number")];
  if (section === "Organizações" && !editing) fields.push(<details className="optional-contract" key="contrato"><summary>Cadastrar contrato junto com a organização (opcional)</summary><div className="form-grid">{input("dataAssinatura", "Data de assinatura", "date", false)}{input("dataVencimento", "Data de vencimento", "date", false)}{input("valorMensal", "Valor mensal", "number", false)}<label>Renovação automática<select value={form.renovacaoAutomatica ?? "false"} onChange={event => set("renovacaoAutomatica", event.target.value)}><option value="false">Não</option><option value="true">Sim</option></select></label>{input("clausulas", "Cláusulas (separadas por ponto e vírgula)", "text", false)}</div></details>);
  return <form className="editor-card" onSubmit={onSubmit}><div className="editor-title"><h2>{editing ? "Editar registro" : "Novo registro"}</h2><span>{editing ? `Versão atual ${editing.version}; alterações concorrentes serão sinalizadas.` : "Campos são enviados conforme o contrato da API."}</span></div><div className="form-grid">{fields}</div><div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar registro"}<span>→</span></button><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button></div></form>;
}

function toPayload(section: Section, form: Record<string, string>, editing: any, lots: any[]) {
  const payload: Record<string, unknown> = {};
  if (section === "Organizações") {
    if (editing) { for (const key of ["razaoSocial", "cnpj", "inscricaoEstadual", "enderecoCompleto", "telefone", "email"]) if (form[key] !== undefined) payload[key] = form[key]; payload.version = editing.version; }
    else {
      for (const key of ["razaoSocial", "cnpj", "inscricaoEstadual", "enderecoCompleto", "telefone", "email"]) if (form[key]) payload[key] = form[key];
      if (form.dataAssinatura && form.dataVencimento && form.valorMensal) payload.contratoVigente = { dataAssinatura: new Date(form.dataAssinatura).toISOString(), dataVencimento: new Date(form.dataVencimento).toISOString(), valorMensal: Number(form.valorMensal), renovacaoAutomatica: form.renovacaoAutomatica === "true", clausulas: form.clausulas.split(";").map(value => value.trim()).filter(Boolean) };
    }
  } else if (section === "Lotes") {
    if (editing) { payload.version = editing.version; for (const key of ["notaFiscal", "transportadora", "observacoes"]) if (form[key] !== undefined) payload[key] = form[key]; if (form.dataEntrada) payload.dataEntrada = new Date(form.dataEntrada).toISOString(); }
    else { payload.organizacaoId = form.organizacaoId; payload.notaFiscal = form.notaFiscal; payload.transportadora = form.transportadora; payload.observacoes = form.observacoes ?? ""; if (form.dataEntrada) payload.dataEntrada = new Date(form.dataEntrada).toISOString(); }
  } else if (section === "Equipamentos") {
    if (editing) { payload.version = editing.version; for (const key of ["marca", "modelo"]) payload[key] = form[key]; payload.anoFabricacao = Number(form.anoFabricacao); payload.pesoQuilogramas = Number(form.pesoQuilogramas); }
    else { for (const key of ["codigoBarrasInterno", "tipo", "marca", "modelo", "estadoFisico", "loteId"]) payload[key] = form[key]; payload.anoFabricacao = Number(form.anoFabricacao); payload.pesoQuilogramas = Number(form.pesoQuilogramas); payload.posicaoNoLote = Number(form.posicaoNoLote); payload.versionLote = Number(lots.find(lot => lot.id === form.loteId)?.version); }
  }
  return payload;
}

function ContractPanel({ organization, request, user, onNotice, onClose, onRefresh }: { organization: any; request: Request; user: User; onNotice: (message: string) => void; onClose: () => void; onRefresh: () => void }) {
  const [contracts, setContracts] = useState<any[]>(organization.contratos ?? []); const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState<Record<string, string>>({}); const [editing, setEditing] = useState<any | null>(null);
  const reload = useCallback(() => { request(`/organizacoes/${organization.id}/contratos`).then(setContracts).catch((error: Error) => onNotice(error.message)); }, [onNotice, organization.id, request]);
  useEffect(() => { reload(); }, [reload]);
  const canMutate = user.papel !== "AUDITOR";
  async function save(event: FormEvent) { event.preventDefault();
    try {
      const body: Record<string, unknown> = {};
      if (editing) { body.version = editing.version; if (form.dataAssinatura) body.dataAssinatura = new Date(form.dataAssinatura).toISOString(); if (form.dataVencimento) body.dataVencimento = new Date(form.dataVencimento).toISOString(); if (form.valorMensal) body.valorMensal = Number(form.valorMensal); if (form.clausulas !== undefined) body.clausulas = form.clausulas.split(";").map(value => value.trim()).filter(Boolean); body.renovacaoAutomatica = form.renovacaoAutomatica === "true"; }
      else Object.assign(body, { dataAssinatura: new Date(form.dataAssinatura).toISOString(), dataVencimento: new Date(form.dataVencimento).toISOString(), valorMensal: Number(form.valorMensal), renovacaoAutomatica: form.renovacaoAutomatica === "true", clausulas: form.clausulas.split(";").map(value => value.trim()).filter(Boolean) });
      await request(editing ? `/organizacoes/${organization.id}/contratos/${editing.id}` : `/organizacoes/${organization.id}/contratos`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setFormOpen(false); setEditing(null); setForm({}); onNotice(editing ? "Contrato atualizado." : "Contrato cadastrado."); reload(); onRefresh();
    } catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível salvar o contrato."); }
  }
  async function endContract(contract: any) { const motivo = window.prompt("Motivo do encerramento do contrato:"); if (!motivo?.trim()) return;
    try { await request(`/organizacoes/${organization.id}/contratos/${contract.id}`, { method: "DELETE", body: JSON.stringify({ version: contract.version, motivo }) }); onNotice("Contrato encerrado e mantido no histórico."); reload(); onRefresh(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Não foi possível encerrar o contrato."); }
  }
  return <div className="editor-card"><div className="table-heading"><div><h2>Contratos · {organization.razaoSocial}</h2><p>{contracts.length} registro(s) no histórico</p></div><div className="form-actions">{canMutate && contracts.length === 0 && <button className="secondary-button" onClick={() => { setForm({}); setEditing(null); setFormOpen(!formOpen); }}>+ Novo contrato</button>}<button className="icon-button" onClick={onClose}>Fechar</button></div></div>
    {formOpen && <form onSubmit={save}><div className="form-grid">{contractField("dataAssinatura", "Assinatura", form, setForm, "date", !editing)}{contractField("dataVencimento", "Vencimento", form, setForm, "date", !editing)}{contractField("valorMensal", "Valor mensal", form, setForm, "number", !editing)}{contractField("clausulas", "Cláusulas (separadas por ponto e vírgula)", form, setForm, "text", !editing)}<label>Renovação automática<select value={form.renovacaoAutomatica ?? "false"} onChange={event => setForm({ ...form, renovacaoAutomatica: event.target.value })}><option value="false">Não</option><option value="true">Sim</option></select></label></div><div className="form-actions"><button className="primary-button">{editing ? "Salvar contrato" : "Cadastrar contrato"}</button><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Fechar</button></div></form>}
    {contracts.length === 0 ? <div className="empty-state">Nenhum contrato cadastrado.</div> : <div className="table-scroll"><table><thead><tr><th>Assinatura</th><th>Vencimento</th><th>Valor mensal</th><th>Estado</th>{canMutate && <th>Ações</th>}</tr></thead><tbody>{contracts.map(contract => <tr key={contract.id}><td>{dateText(contract.dataAssinatura)}</td><td>{dateText(contract.dataVencimento)}</td><td>{money(contract.valorMensal)}</td><td>{contract.encerradoEm ? `Encerrado · ${contract.motivoEncerramento}` : "Vigente"}</td>{canMutate && <td className="actions-cell">{!contract.encerradoEm && <><button className="text-button" onClick={() => { setEditing(contract); setForm({ dataAssinatura: toDateInput(contract.dataAssinatura), dataVencimento: toDateInput(contract.dataVencimento), valorMensal: String(contract.valorMensal), clausulas: (contract.clausulas ?? []).join("; "), renovacaoAutomatica: String(contract.renovacaoAutomatica) }); setFormOpen(true); }}>Editar</button><button className="text-button danger" onClick={() => endContract(contract)}>Encerrar</button></>}</td>}</tr>)}</tbody></table></div>}
  </div>;
}
function contractField(key: string, label: string, form: Record<string, string>, setForm: (data: Record<string, string>) => void, type: string, required: boolean) { return <label key={key}>{label}<input type={type} required={required} step={type === "number" ? "0.01" : undefined} value={form[key] ?? ""} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>; }
function EventList({ events }: { events: any[] }) { return <div className="event-list">{events.length === 0 ? <p>Nenhum evento de rastreabilidade.</p> : events.map(event => <article key={event.id}><div><b>{labelEnum(event.tipoEvento ?? "REGISTRO")}</b><small>{dateText(event.dataHora)} · {event.responsavel}</small></div><p>{event.origem} → {event.destino}</p>{event.observacao && <small>{event.observacao}</small>}</article>)}</div>; }

function labelEnum(value: string) { return value.replaceAll("_", " ").toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase("pt-BR")); }
function toDateInput(value: string | Date) { return new Date(value).toISOString().slice(0, 10); }
function dateText(value: string | Date) { return new Date(value).toLocaleDateString("pt-BR"); }
function money(value: string | number) { return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function renderValue(item: any, key: string): ReactNode {
  const raw = key === "organizacao" ? item.organizacao?.razaoSocial : key === "equipamentos" ? item.equipamentos?.length : key === "contratoVigente" ? item.contratoVigente ? "Ativo" : "—" : item[key];
  if (raw === null || raw === undefined || raw === "") return "—";
  if (key.toLowerCase().includes("status") || key === "estadoFisico" || key === "contratoVigente") return <span className="table-badge">{String(raw).replaceAll("_", " ")}</span>;
  if (key.includes("data")) return dateText(raw);
  return String(raw);
}

export default App;
