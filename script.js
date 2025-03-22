// Configurações globais
const CONFIG = {
  API_BASE_URL: '',
  NOTIFICATION_CHECK_INTERVAL: 60000,
  DATE_FORMAT: 'pt-BR'
};

// Classe principal do sistema
class ChamadosSystem {
  constructor() {
    this.user = null;
    this.notificationCount = 0;
    this.setores = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkUserSession();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Login
    document.getElementById('loginForm')?.addEventListener('submit', this.handleLogin.bind(this));
    
    // Forms
    document.getElementById('ticketForm')?.addEventListener('submit', this.handleTicketSubmit.bind(this));
    document.getElementById('cadastroColaboradorForm')?.addEventListener('submit', this.handleColaboradorSubmit.bind(this));
    document.getElementById('setorForm')?.addEventListener('submit', this.handleSetorSubmit.bind(this));
    document.getElementById('categoriaForm')?.addEventListener('submit', this.handleCategoriaSubmit.bind(this));
    document.getElementById('changePasswordForm')?.addEventListener('submit', this.handlePasswordChange.bind(this));
    
    // Menus
    this.setupMenuListeners();
    
    // Modais
    this.setupModalListeners();

    // Notificações e Logout
    document.querySelector('.notification')?.addEventListener('click', () => this.showNotifications());
    document.querySelector('.logout-btn')?.addEventListener('click', () => this.logout());

    // Evento de mudança no setor destino
    document.getElementById('setorDestino')?.addEventListener('change', (e) => this.loadUsuariosPorSetor(e.target.value));
  }

  setupMenuListeners() {
    // Menu do usuário
    const userMenuItems = document.querySelectorAll('#userMenu .menu-item');
    userMenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        if (section) {
          userMenuItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          this.showUserSection(section);
        }
      });
    });

    // Menu do admin
    const adminMenuItems = document.querySelectorAll('#adminMenu .menu-item');
    adminMenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        if (section === 'toggleSubmenu') {
          const submenu = document.querySelector('#adminMenu .submenu');
          submenu.classList.toggle('active');
          return;
        }
        if (section) {
          adminMenuItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          this.showAdminSection(section);
        }
      });
    });

    // Submenu do admin
    const submenuItems = document.querySelectorAll('#adminMenu .submenu li');
    submenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        if (section) {
          submenuItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          this.showAdminSection(section);
        }
      });
    });
  }

  checkUserSession() {
    const userName = sessionStorage.getItem('user_nome');
    const isAdmin = sessionStorage.getItem('is_admin');
    
    if (userName) {
      this.user = {
        nome: userName,
        isAdmin: isAdmin === '1',
        id: sessionStorage.getItem('user_id'),
        setorId: sessionStorage.getItem('user_setor')
      };
      this.updateUIForLoggedUser();
    }
  }

  loadInitialData() {
    this.loadSetores();
    this.loadColaboradores();
    this.loadCategorias();
  }

  // Métodos de API
  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Erro na requisição para ${endpoint}:`, error);
      throw error;
    }
  }

  // Handlers de eventos
  async handleLogin(e) {
    e.preventDefault();
    const loginData = {
      nome: document.getElementById('nomeLogin').value,
      senha: document.getElementById('senhaLogin').value
    };

    try {
      const data = await this.apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
      });

      if (data.error) {
        this.showAlert(data.error);
        return;
      }

      this.handleSuccessfulLogin(data);
    } catch (error) {
      this.showAlert('Erro ao fazer login. Tente novamente.');
    }
  }

  handleSuccessfulLogin(data) {
    console.log('Dados do login recebidos:', data);
    
    // Garantir que o ID seja uma string
    const userId = String(data.id);
    
    this.user = {
      id: userId,
      isAdmin: data.is_admin === '1',
      nome: data.nome,
      setorId: data.setor_id
    };

    console.log('Dados do usuário processados:', this.user);
    
    // Salvar na sessão
    sessionStorage.setItem('user_id', userId);
    sessionStorage.setItem('is_admin', data.is_admin);
    sessionStorage.setItem('user_nome', data.nome);
    sessionStorage.setItem('user_setor', data.setor_id);
    
    console.log('Dados salvos na sessão:', {
      id: sessionStorage.getItem('user_id'),
      is_admin: sessionStorage.getItem('is_admin'),
      nome: sessionStorage.getItem('user_nome'),
      setor: sessionStorage.getItem('user_setor')
    });

    this.updateUIForLoggedUser();
    this.startNotificationCheck();
  }

  // Métodos de UI
  updateUIForLoggedUser() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';

    if (this.user.isAdmin) {
      this.showAdminUI();
    } else {
      this.showUserUI();
    }
  }

  showAdminUI() {
    document.getElementById('adminMenuContainer').style.display = 'block';
    document.getElementById('adminMenu').style.display = 'block';
    document.getElementById('userContent').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    document.getElementById('adminGreeting').textContent = `Olá, ${this.user.nome}!`;
    this.showAdminSection('inicio');
  }

  showUserUI() {
    document.getElementById('userContent').style.display = 'flex';
    document.getElementById('userGreeting').textContent = `Olá, ${this.user.nome}!`;
    this.showUserSection('novoTicket');
  }

  // Métodos de utilidade
  showAlert(message) {
    const alertElement = document.getElementById('customAlert');
    const messageElement = alertElement.querySelector('.custom-alert-message');
    messageElement.textContent = message;
    alertElement.style.display = 'flex';
  }

  formatDate(date) {
    if (!date) return '-';
    const partes = date.split(' ');
    if (partes.length !== 2) return date;
    
    const [data_, hora] = partes;
    const [dia, mes, ano] = data_.split('/');
    return `${dia}/${mes}/${ano} ${hora}`;
  }

  // Gerenciamento de Tickets
  async handleTicketSubmit(e) {
    e.preventDefault();
    const ticket = this.getTicketFormData();
    
    try {
      await this.apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(ticket)
      });
      
      this.showAlert('Ticket enviado com sucesso!');
      document.getElementById('ticketForm').reset();
      this.updateNotificationCount(1);
    } catch (error) {
      this.showAlert('Erro ao enviar ticket. Tente novamente.');
    }
  }

  getTicketFormData() {
    const conclusaoRaw = document.getElementById('conclusao').value;
    let conclusao = '';
    
    if (conclusaoRaw) {
      const date = new Date(conclusaoRaw);
      conclusao = this.formatDateTime(date);
    }

    return {
      nome: document.getElementById('nome').value,
      prioridade: document.getElementById('prioridade').value,
      descricao: document.getElementById('descricao').value,
      setor_destino_id: document.getElementById('setorDestino').value,
      solicitante_id: this.user.id,
      status: 'pendente',
      data_criacao: this.formatDateTime(new Date()),
      conclusao: conclusao
    };
  }

  formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  async loadTicketsSolicitante() {
    try {
      console.log('Iniciando carregamento de tickets do solicitante...');
      if (!this.user?.id) {
        console.error('ID do usuário não encontrado:', this.user);
        this.showAlert('Erro: Usuário não identificado. Por favor, faça login novamente.');
        return;
      }

      console.log('Fazendo requisição para /tickets com ID:', this.user.id);
      const tickets = await this.apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'solicitante',
          solicitante_id: this.user.id
        })
      });
      
      console.log('Tickets recebidos:', tickets);
      
      if (!Array.isArray(tickets)) {
        console.error('Resposta inválida (não é um array):', tickets);
        this.showAlert('Erro ao carregar tickets. Formato de resposta inválido.');
        return;
      }

      // Atualizar a tabela com os tickets
      const tbody = document.querySelector('#ticketsSolicitante tbody');
      if (!tbody) {
        console.error('Elemento tbody não encontrado');
        return;
      }

      tbody.innerHTML = '';

      if (tickets.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <i class="fas fa-inbox"></i>
              <p>Nenhum ticket encontrado</p>
            </td>
          </tr>`;
      } else {
        tickets.forEach(ticket => {
          const tr = document.createElement('tr');
          tr.innerHTML = this.getTicketRowHTML(ticket);
          tbody.appendChild(tr);
        });
      }
      
      // Atualizar contadores
      const total = tickets.length;
      const pendentes = tickets.filter(t => t.status === 'pendente').length;
      const emAndamento = tickets.filter(t => t.status === 'em_andamento').length;
      const resolvidos = tickets.filter(t => t.status === 'finalizado').length;

      document.getElementById('totalTickets').textContent = total;
      document.getElementById('pendingTickets').textContent = pendentes;
      document.getElementById('inProgressTickets').textContent = emAndamento;
      document.getElementById('resolvedTickets').textContent = resolvidos;

      console.log('Carregamento de tickets concluído com sucesso');
    } catch (error) {
      console.error('Erro detalhado ao carregar tickets:', error);
      this.showAlert('Erro ao carregar tickets. Por favor, tente novamente.');
      
      // Mostrar estado vazio em caso de erro
      const tbody = document.querySelector('#ticketsSolicitante tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state error-state">
              <i class="fas fa-exclamation-circle"></i>
              <p>Erro ao carregar tickets</p>
              <small>${error.message}</small>
            </td>
          </tr>`;
      }
    }
  }

  getTicketRowHTML(ticket) {
    const prioridade = ticket.prioridade.toUpperCase();
    const status = ticket.status.toUpperCase();
    
    return `
      <td>${ticket.id}</td>
      <td>${ticket.nome}</td>
      <td><span class="priority-label priority-${ticket.prioridade.toLowerCase()}">${prioridade}</span></td>
      <td><span class="status-label status-${ticket.status.toLowerCase()}">${status}</span></td>
      <td>${this.formatDate(ticket.data_criacao)}</td>
      <td>${ticket.conclusao ? this.formatDate(ticket.conclusao) : '-'}</td>
      <td>
        <button class="action-btn" onclick="chamadosSystem.showTicketDetails(${ticket.id})">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
  }

  async loadTicketsSetor() {
    try {
      if (!this.user?.setorId) {
        console.error('Setor não identificado para o usuário:', this.user);
        this.showAlert('Erro: Setor não identificado. Por favor, faça login novamente.');
        return;
      }

      console.log('Carregando tickets do setor:', this.user.setorId);
      const response = await this.apiRequest(`/tickets/setor/${this.user.setorId}`);
      console.log('Resposta do servidor:', response);
      
      if (!response) {
        console.error('Resposta vazia do servidor');
        this.showAlert('Erro: Nenhum dado recebido do servidor.');
        return;
      }

      // Se a resposta for um array, atualiza a tabela
      if (Array.isArray(response)) {
        this.updateTicketsTable('ticketsSetor', response);
        
        // Atualizar contadores específicos do setor
        const total = response.length;
        const pendentes = response.filter(t => t.status === 'pendente').length;
        const emAndamento = response.filter(t => t.status === 'em_andamento').length;
        const resolvidos = response.filter(t => t.status === 'finalizado').length;

        // Atualizar os contadores com os IDs corretos
        document.getElementById('totalTicketsSetor').textContent = total;
        document.getElementById('pendingTicketsSetor').textContent = pendentes;
        document.getElementById('inProgressTicketsSetor').textContent = emAndamento;
        document.getElementById('resolvedTicketsSetor').textContent = resolvidos;
      } else {
        console.error('Formato de resposta inválido:', response);
        this.showAlert('Erro: Formato de resposta inválido do servidor.');
      }

    } catch (error) {
      console.error('Erro ao carregar tickets do setor:', error);
      // Só mostra o alerta se não houver tickets carregados
      const tbody = document.querySelector('#ticketsSetor tbody');
      if (!tbody || !tbody.children.length) {
        this.showAlert('Erro ao carregar tickets do setor. Por favor, tente novamente.');
      }
    }
  }

  updateTicketsTable(tableId, tickets) {
    console.log('Atualizando tabela:', tableId, 'com', tickets.length, 'tickets');
    const tbody = document.querySelector(`#${tableId} tbody`);
    
    if (!tbody) {
      console.error('Elemento tbody não encontrado para a tabela:', tableId);
      return;
    }

    tbody.innerHTML = '';

    if (tickets.length === 0) {
      tbody.innerHTML = this.getEmptyStateHTML();
      return;
    }

    tickets.forEach(ticket => {
      const tr = document.createElement('tr');
      tr.innerHTML = this.getTicketRowHTML(ticket);
      tr.addEventListener('click', () => this.showTicketDetails(ticket.id));
      tbody.appendChild(tr);
    });
  }

  getEmptyStateHTML() {
    return `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Nenhum ticket encontrado</p>
        </td>
      </tr>`;
  }

  updateTicketsSummary(tickets, elementId = 'ticketsSummary') {
    const total = tickets.length;
    const pendentes = tickets.filter(t => t.status === 'pendente').length;
    const emAndamento = tickets.filter(t => t.status === 'em_andamento').length;
    const resolvidos = tickets.filter(t => t.status === 'finalizado').length;

    const summaryHTML = this.user?.isAdmin ? 
      this.getAdminSummaryHTML(total, pendentes, emAndamento, resolvidos) :
      `Abertos: ${total} | Pendentes: ${pendentes} | Em andamento: ${emAndamento} | Resolvidos: ${resolvidos}`;

    document.getElementById(elementId).innerHTML = summaryHTML;
  }

  getAdminSummaryHTML(total, pendentes, emAndamento, resolvidos) {
    return `
      <div class="summary-item">
        <i class="fas fa-ticket-alt"></i>
        <span>Total: <strong>${total}</strong></span>
      </div>
      <div class="summary-item">
        <i class="fas fa-clock"></i>
        <span>Pendentes: <strong>${pendentes}</strong></span>
      </div>
      <div class="summary-item">
        <i class="fas fa-sync-alt"></i>
        <span>Em andamento: <strong>${emAndamento}</strong></span>
      </div>
      <div class="summary-item">
        <i class="fas fa-check-circle"></i>
        <span>Resolvidos: <strong>${resolvidos}</strong></span>
      </div>
    `;
  }

  // Gerenciamento de Notificações
  startNotificationCheck() {
    this.checkNewNotifications();
    setInterval(() => this.checkNewNotifications(), CONFIG.NOTIFICATION_CHECK_INTERVAL);
  }

  async checkNewNotifications() {
    try {
      const notificacoes = await this.apiRequest('/notificacoes');
      const unreadCount = notificacoes.filter(n => n.lida === '0').length;
      this.updateNotificationCount(unreadCount);
    } catch (error) {
      console.error('Erro ao verificar notificações:', error);
    }
  }

  updateNotificationCount(count) {
    this.notificationCount = count;
    document.getElementById('notificationCount').textContent = count.toString();
    sessionStorage.setItem('notificationCount', count.toString());
  }

  async showNotifications() {
    try {
      const notificacoes = await this.apiRequest('/notificacoes');
      this.updateNotificationsUI(notificacoes);
      document.getElementById('notificationModal').style.display = 'block';
    } catch (error) {
      this.showAlert('Erro ao carregar notificações. Tente novamente.');
    }
  }

  updateNotificationsUI(notificacoes) {
    const notificationList = document.getElementById('notificationList');
    notificationList.innerHTML = '';

    if (notificacoes.length === 0) {
      notificationList.innerHTML = this.getEmptyNotificationHTML();
      return;
    }

    notificacoes.forEach(n => {
      const notificationDiv = document.createElement('div');
      notificationDiv.className = `notification-item ${n.tipo} ${n.lida === '0' ? 'unread' : ''}`;
      notificationDiv.innerHTML = this.getNotificationHTML(n);
      notificationList.appendChild(notificationDiv);
    });
  }

  getEmptyNotificationHTML() {
    return `
      <div class="notification-item">
        <i class="fas fa-check-circle"></i>
        <div class="notification-content">
          <div class="notification-message">Nenhuma notificação encontrada</div>
        </div>
      </div>`;
  }

  getNotificationHTML(notification) {
    const icon = this.getNotificationIcon(notification.tipo);
    const message = this.formatNotificationMessage(notification);

    return `
      <i class="fas ${icon}"></i>
      <div class="notification-content">
        <div class="notification-message">${message}</div>
        <div class="notification-timestamp">${notification.data_hora}</div>
      </div>
    `;
  }

  getNotificationIcon(tipo) {
    const icons = {
      abertura: 'fa-ticket-alt',
      comentario: 'fa-comment',
      prazo: 'fa-clock',
      status: 'fa-sync-alt'
    };
    return icons[tipo] || 'fa-info-circle';
  }

  formatNotificationMessage(notification) {
    const message = notification.mensagem;
    const tipos = {
      abertura: /Novo ticket #\d+ criado por/,
      comentario: /Novo comentário no ticket #\d+ por/,
      status: /Ticket #\d+ atualizado para/
    };

    if (tipos[notification.tipo]) {
      return message.replace(tipos[notification.tipo], this.getNotificationReplacement(notification.tipo));
    }

    return message;
  }

  getNotificationReplacement(tipo) {
    const replacements = {
      abertura: 'Novo ticket criado por',
      comentario: 'Novo comentário adicionado por',
      status: 'Status do ticket atualizado para'
    };
    return replacements[tipo] || message;
  }

  // Gerenciamento de Colaboradores
  async handleColaboradorSubmit(e) {
    e.preventDefault();
    const colaborador = this.getColaboradorFormData();
    
    try {
      await this.apiRequest('/colaboradores', {
        method: 'POST',
        body: JSON.stringify(colaborador)
      });
      
      this.showAlert('Colaborador cadastrado com sucesso!');
      document.getElementById('cadastroColaboradorForm').reset();
      this.loadColaboradores();
    } catch (error) {
      this.showAlert('Erro ao cadastrar colaborador. Tente novamente.');
    }
  }

  getColaboradorFormData() {
    return {
      nome: document.getElementById('nomeColaborador').value,
      setor_id: document.getElementById('setorColaborador').value,
      senha: document.getElementById('senhaColaborador').value,
      is_admin: document.getElementById('isAdminColaborador').value,
      ativo: document.getElementById('ativoColaborador').value,
      data_cadastro: new Date().toLocaleDateString(CONFIG.DATE_FORMAT)
    };
  }

  async loadColaboradores() {
    try {
      const colaboradores = await this.apiRequest('/colaboradores');
      this.updateColaboradoresTable(colaboradores);
    } catch (error) {
      this.showAlert('Erro ao carregar colaboradores. Tente novamente.');
    }
  }

  updateColaboradoresTable(colaboradores) {
    const tbody = document.querySelector('#colaboradoresTable tbody');
    tbody.innerHTML = '';

    if (colaboradores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum colaborador encontrado.</td></tr>';
      return;
    }

    colaboradores.forEach(c => {
      const row = document.createElement('tr');
      row.innerHTML = this.getColaboradorRowHTML(c);
      row.addEventListener('click', () => this.showColaboradorDetails(c));
      tbody.appendChild(row);
    });
  }

  getColaboradorRowHTML(colaborador) {
    const dataCadastro = colaborador.data_cadastro && colaborador.data_cadastro !== '1' ? 
      colaborador.data_cadastro : 'Não definida';
    const ativo = colaborador.ativo === '1' ? 'Sim' : 'Não';

    return `
      <td>${colaborador.id}</td>
      <td>${colaborador.nome}</td>
      <td>${this.getSetorNome(colaborador.setor_id)}</td>
      <td>${ativo}</td>
      <td>${dataCadastro}</td>
    `;
  }

  showColaboradorDetails(colaborador) {
    this.currentColaboradorId = colaborador.id;
    const modal = document.getElementById('colaboradorModal');
    const details = document.getElementById('colaboradorDetails');
    const toggleBtn = document.getElementById('toggleAtivoBtn');
    
    details.innerHTML = this.getColaboradorDetailsHTML(colaborador);
    toggleBtn.textContent = colaborador.ativo === '1' ? 'Desativar' : 'Ativar';
    toggleBtn.setAttribute('data-ativo', colaborador.ativo);
    
    modal.style.display = 'block';
  }

  getColaboradorDetailsHTML(colaborador) {
    const ativo = colaborador.ativo === '1' ? 'Sim' : 'Não';
    const dataCadastro = colaborador.data_cadastro && colaborador.data_cadastro !== '1' ? 
      colaborador.data_cadastro : 'Não definida';

    return `
      <div class="details-grid">
        <div class="detail-item">
          <p><i class="fas fa-id-badge"></i> <strong>ID:</strong> ${colaborador.id}</p>
        </div>
        <div class="detail-item">
          <p><i class="fas fa-user"></i> <strong>Nome:</strong> ${colaborador.nome}</p>
        </div>
        <div class="detail-item">
          <p><i class="fas fa-building"></i> <strong>Setor:</strong> ${this.getSetorNome(colaborador.setor_id)}</p>
        </div>
        <div class="detail-item">
          <p><i class="fas fa-lock"></i> <strong>Senha:</strong> ${colaborador.senha}</p>
        </div>
        <div class="detail-item">
          <p><i class="fas fa-user-shield"></i> <strong>Administrador:</strong> ${colaborador.is_admin === '1' ? 'Sim' : 'Não'}</p>
        </div>
        <div class="detail-item">
          <p><i class="fas fa-check-circle"></i> <strong>Ativo:</strong> ${ativo}</p>
        </div>
        <div class="detail-item full-width">
          <p><i class="fas fa-calendar-alt"></i> <strong>Data de Cadastro:</strong> ${dataCadastro}</p>
        </div>
      </div>
    `;
  }

  async handlePasswordChange(e) {
    e.preventDefault();
    const novaSenha = document.getElementById('novaSenha').value;
    
    try {
      await this.apiRequest(`/colaboradores/${this.currentColaboradorId}/senha`, {
        method: 'PUT',
        body: JSON.stringify({ senha: novaSenha })
      });
      
      this.showAlert('Senha alterada com sucesso!');
      this.closePasswordModal();
      this.loadColaboradores();
    } catch (error) {
      this.showAlert('Erro ao alterar senha. Tente novamente.');
    }
  }

  async toggleAtivoColaborador() {
    const ativo = document.getElementById('toggleAtivoBtn').getAttribute('data-ativo') === '1' ? '0' : '1';
    
    try {
      await this.apiRequest(`/colaboradores/${this.currentColaboradorId}/ativo`, {
        method: 'PUT',
        body: JSON.stringify({ ativo })
      });
      
      this.showAlert('Status atualizado com sucesso!');
      this.loadColaboradores();
      this.closeColaboradorModal();
    } catch (error) {
      this.showAlert('Erro ao atualizar status. Tente novamente.');
    }
  }

  // Gerenciamento de Setores
  async loadSetores() {
    try {
      const setores = await this.apiRequest('/setores');
      this.setores = setores;
      this.updateSetoresDropdowns(setores);
      this.updateSetoresTable(setores);
    } catch (error) {
      this.showAlert('Erro ao carregar setores. Tente novamente.');
    }
  }

  updateSetoresDropdowns(setores) {
    const dropdowns = ['setorDestino', 'setorColaborador', 'setorSelect'];
    dropdowns.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;

      select.innerHTML = id === 'setorSelect' ? 
        '<option value="">Selecione um setor...</option>' : '';

      setores.forEach(setor => {
        const option = document.createElement('option');
        option.value = setor.id;
        option.textContent = setor.nome;
        select.appendChild(option);
      });
    });
  }

  updateSetoresTable(setores) {
    const tbody = document.querySelector('#setoresTable tbody');
    tbody.innerHTML = '';

    setores.forEach(setor => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${setor.id}</td>
        <td>${setor.nome}</td>
      `;
      tbody.appendChild(row);
    });
  }

  getSetorNome(setorId) {
    const setor = this.setores.find(s => s.id === setorId);
    return setor ? setor.nome : 'Desconhecido';
  }

  async handleSetorSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('nomeSetor').value;
    
    try {
      await this.apiRequest('/setores', {
        method: 'POST',
        body: JSON.stringify({ nome })
      });
      
      this.showAlert('Setor cadastrado com sucesso!');
      this.loadSetores();
      this.toggleSetorForm();
    } catch (error) {
      this.showAlert('Erro ao cadastrar setor. Tente novamente.');
    }
  }

  // Métodos de UI
  toggleSetorForm() {
    const form = document.getElementById('setorForm');
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
  }

  closeColaboradorModal() {
    document.getElementById('colaboradorModal').style.display = 'none';
  }

  closePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
  }

  setupModalListeners() {
    // Fechar modais ao clicar no X
    document.querySelectorAll('.close, .close-notification, .close-colaborador, .close-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.style.display = 'none';
      });
    });

    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });

    // Configurar botão de marcar todas como lidas
    document.querySelector('.mark-all-read')?.addEventListener('click', () => this.marcarTodasNotificacoesLidas());
  }

  // Gerenciamento de Categorias
  async loadCategorias() {
    try {
      const categorias = await this.apiRequest('/categorias');
      this.updateCategoriasTable(categorias);
    } catch (error) {
      this.showAlert('Erro ao carregar categorias. Tente novamente.');
    }
  }

  updateCategoriasTable(categorias) {
    const tbody = document.querySelector('#categoriasTable tbody');
    tbody.innerHTML = '';

    categorias.forEach(categoria => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${categoria.id}</td>
        <td>${categoria.nome}</td>
      `;
      tbody.appendChild(row);
    });
  }

  async handleCategoriaSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('nomeCategoria').value;
    
    try {
      await this.apiRequest('/categorias', {
        method: 'POST',
        body: JSON.stringify({ nome })
      });
      
      this.showAlert('Categoria cadastrada com sucesso!');
      this.loadCategorias();
      this.toggleCategoriaForm();
    } catch (error) {
      this.showAlert('Erro ao cadastrar categoria. Tente novamente.');
    }
  }

  toggleCategoriaForm() {
    const form = document.getElementById('categoriaForm');
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
  }

  // Gerenciamento de Relatórios
  async loadRelatorio() {
    try {
      const updates = await this.apiRequest('/relatorio/ultimas_atualizacoes');
      this.updateRelatorioUI(updates);
    } catch (error) {
      this.showAlert('Erro ao carregar relatório. Tente novamente.');
    }
  }

  updateRelatorioUI(updates) {
    const container = document.getElementById('ultimasAtualizacoes');
    container.innerHTML = '';

    updates.forEach(u => {
      const updateDiv = document.createElement('div');
      updateDiv.className = 'update-item';
      updateDiv.innerHTML = `
        <div class="update-message">Ticket #${u.id} - ${u.nome} (${u.status}) - Setor: ${u.setor_destino}</div>
        <div class="update-timestamp">${u.data_criacao}</div>
      `;
      container.appendChild(updateDiv);
    });
  }

  // Dashboard
  async updateDashboardStats() {
    try {
      const [tickets, colaboradores, setores] = await Promise.all([
        this.apiRequest('/tickets'),
        this.apiRequest('/colaboradores'),
        this.apiRequest('/setores')
      ]);

      // Atualizar total de tickets
      const totalTicketsElement = document.getElementById('totalTicketsAdmin');
      if (totalTicketsElement) {
        totalTicketsElement.textContent = tickets.length || '0';
      }
      
      // Atualizar total de colaboradores
      const totalColabElement = document.getElementById('totalColaboradores');
      if (totalColabElement) {
        totalColabElement.textContent = colaboradores.length || '0';
      }
      
      // Atualizar total de setores
      const totalSetoresElement = document.getElementById('totalSetores');
      if (totalSetoresElement) {
        totalSetoresElement.textContent = setores.length || '0';
      }
      
      // Atualizar tickets pendentes
      const ticketsPendentesElement = document.getElementById('ticketsPendentes');
      if (ticketsPendentesElement) {
        const pendentes = tickets.filter(t => t.status === 'pendente').length;
        ticketsPendentesElement.textContent = pendentes || '0';
      }

      console.log('Dashboard atualizado com sucesso:', {
        tickets: tickets.length,
        colaboradores: colaboradores.length,
        setores: setores.length,
        pendentes: tickets.filter(t => t.status === 'pendente').length
      });
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  // Navegação
  showUserSection(section) {
    console.log('Mostrando seção:', section);
    this.hideAllUserSections();
    
    // Atualizar item ativo no menu
    document.querySelectorAll('#userMenu .menu-item').forEach(item => {
      if (item.getAttribute('data-section') === section) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Mostrar a seção selecionada
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
      sectionElement.style.display = 'block';
    } else {
      console.error('Seção não encontrada:', section);
      return;
    }
    
    if (!this.user) {
      console.error('Usuário não está logado');
      return;
    }

    switch (section) {
      case 'meusTickets':
        console.log('Carregando meus tickets...');
        this.loadTicketsSolicitante();
        break;
      case 'ticketsSetor':
        this.loadTicketsSetor();
        break;
      case 'novoTicket':
        this.loadSetores();
        this.loadColaboradores();
        // Limpar o select de usuário destino
        const selectUsuario = document.getElementById('usuarioDestino');
        if (selectUsuario) {
          selectUsuario.innerHTML = '<option value="">Selecione um usuário</option>';
        }
        break;
    }
  }

  hideAllUserSections() {
    console.log('Ocultando todas as seções do usuário');
    document.querySelectorAll('.user-section').forEach(el => {
      el.style.display = 'none';
    });
  }

  showSelectedSection(section) {
    console.log('Mostrando seção selecionada:', section);
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
      sectionElement.style.display = 'block';
    } else {
      console.error('Seção não encontrada:', section);
    }
  }

  showAdminSection(section) {
    console.log('Mostrando seção admin:', section);
    this.hideAllAdminSections();
    
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
      sectionElement.style.display = 'block';
      this.loadAdminSectionData(section);
    }
  }

  hideAllAdminSections() {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.style.display = 'none';
    });
  }

  loadAdminSectionData(section) {
    switch (section) {
      case 'inicio':
        this.updateDashboardStats();
        break;
      case 'cadastroColaboradores':
        this.loadSetores();
        break;
      case 'colaboradores':
        this.loadColaboradores();
        break;
      case 'setores':
        this.loadSetores();
        break;
      case 'categorias':
        this.loadCategorias();
        break;
      case 'relatorios':
        this.loadRelatorio();
        break;
    }
  }

  // Logout
  async logout() {
    try {
      await this.apiRequest('/logout', { method: 'POST' });
      this.clearSession();
      this.resetUI();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  clearSession() {
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('is_admin');
    sessionStorage.removeItem('user_nome');
    sessionStorage.removeItem('user_setor');
    sessionStorage.removeItem('notificationCount');
  }

  resetUI() {
    // Limpar campos do formulário
    document.getElementById('nomeLogin').value = '';
    document.getElementById('senhaLogin').value = '';
    
    // Restaurar estado inicial
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('adminMenuContainer').style.display = 'none';
    document.getElementById('adminMenu').style.display = 'none';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('userContent').style.display = 'block';
    
    // Resetar contador de notificações
    document.getElementById('notificationCount').textContent = '0';
  }

  // Métodos de utilidade
  saveUserSession() {
    console.log('Salvando sessão do usuário:', this.user);
    sessionStorage.setItem('user_id', this.user.id);
    sessionStorage.setItem('is_admin', this.user.isAdmin ? '1' : '0');
    sessionStorage.setItem('user_nome', this.user.nome);
    sessionStorage.setItem('user_setor', this.user.setorId);
  }

  // Gerenciamento de Detalhes do Ticket
  getTicketDetailsHTML(ticket) {
    return `
      <div class="ticket-details">
        <p>
          <i class="fas fa-hashtag"></i>
          <strong>ID:</strong>
          ${ticket.id}
        </p>
        <p>
          <i class="fas fa-ticket-alt"></i>
          <strong>Assunto:</strong>
          ${ticket.nome}
        </p>
        <p>
          <i class="fas fa-exclamation-circle"></i>
          <strong>Prioridade:</strong>
          <span class="priority-label priority-${ticket.prioridade.toLowerCase()}">${ticket.prioridade}</span>
        </p>
        <p>
          <i class="fas fa-tag"></i>
          <strong>Status:</strong>
          <span class="status-label status-${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span>
        </p>
        <p>
          <i class="fas fa-building"></i>
          <strong>Setor:</strong>
          ${ticket.setor_destino_nome}
        </p>
        <p>
          <i class="fas fa-user"></i>
          <strong>Solicitante:</strong>
          ${ticket.solicitante_nome}
        </p>
        <p>
          <i class="fas fa-calendar-alt"></i>
          <strong>Criado em:</strong>
          ${ticket.data_criacao}
        </p>
        <p>
          <i class="fas fa-calendar-check"></i>
          <strong>Conclusão:</strong>
          ${ticket.conclusao || 'Não definida'}
        </p>
        <p class="full-width">
          <i class="fas fa-align-left"></i>
          <strong>Descrição:</strong>
          ${ticket.descricao}
        </p>
        ${ticket.motivo ? `
        <p class="full-width">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Motivo da Reprovação:</strong>
          ${ticket.motivo}
        </p>` : ''}
      </div>
    `;
  }

  async carregarAtualizacoes(ticketId) {
    try {
      const atualizacoes = await this.apiRequest(`/atualizacoes/${ticketId}`);
      const commentContainer = document.getElementById('atualizacoes');
      
      if (!commentContainer) return;
      
      commentContainer.innerHTML = '';
      
      atualizacoes.forEach(a => {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerHTML = `
          <div class="comment-header">
            <span class="comment-author">${a.colaborador_nome}</span>
            <span class="comment-timestamp">${a.data_hora}</span>
          </div>
          <div class="comment-text">${a.comentario}</div>
        `;
        commentContainer.appendChild(commentDiv);
      });
      
      commentContainer.scrollTop = commentContainer.scrollHeight;
    } catch (error) {
      console.error('Erro ao carregar atualizações:', error);
    }
  }

  async enviarComentario() {
    const comentario = document.getElementById('novoComentario').value;
    if (!comentario.trim()) return;

    try {
      await this.apiRequest('/atualizacoes', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: this.currentTicketId,
          comentario: comentario
        })
      });
      
      document.getElementById('novoComentario').value = '';
      await this.carregarAtualizacoes(this.currentTicketId);
    } catch (error) {
      console.error('Erro ao enviar comentário:', error);
      this.showAlert('Erro ao enviar comentário. Tente novamente.');
    }
  }

  async marcarTodasNotificacoesLidas() {
    try {
      const data = await this.apiRequest('/notificacoes/marcar_lidas', {
        method: 'POST'
      });

      if (data.error) {
        throw new Error(data.error);
      }

      // Atualizar visual das notificações com animação
      const notifications = document.querySelectorAll('.notification-item');
      notifications.forEach(notification => {
        notification.classList.add('fade-out');
      });
      
      // Remover as notificações após a animação
      setTimeout(() => {
        const notificationList = document.getElementById('notificationList');
        notificationList.innerHTML = this.getEmptyNotificationHTML();
      }, 300);
      
      // Zerar o contador
      this.updateNotificationCount(0);
      
      // Mostrar mensagem de sucesso
      this.showAlert(`${data.atualizadas} notificações foram marcadas como lidas`);
      
      // Fechar o modal
      document.getElementById('notificationModal').style.display = 'none';
      
      // Forçar uma verificação das notificações
      this.checkNewNotifications();
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      this.showAlert('Erro ao marcar notificações como lidas');
    }
  }

  async showTicketDetails(ticketId) {
    try {
      const ticket = await this.apiRequest(`/tickets/${ticketId}`);
      this.currentTicketId = ticketId;
      
      const modal = document.getElementById('ticketModal');
      const details = document.getElementById('ticketDetails');
      
      if (!modal || !details) {
        console.error('Modal ou container de detalhes não encontrado');
        return;
      }
      
      details.innerHTML = this.getTicketDetailsHTML(ticket);
      
      // Limpar e carregar comentários
      const atualizacoesContainer = document.getElementById('atualizacoes');
      if (atualizacoesContainer) {
        atualizacoesContainer.innerHTML = '';
      }
      
      const comentarioInput = document.getElementById('novoComentario');
      if (comentarioInput) {
        comentarioInput.value = '';
      }
      
      // Carregar atualizações
      await this.carregarAtualizacoes(ticketId);
      
      // Exibir modal
      modal.style.display = 'block';
      
      // Focar no campo de comentário
      if (comentarioInput) {
        comentarioInput.focus();
      }
    } catch (error) {
      console.error('Erro ao exibir detalhes do ticket:', error);
      this.showAlert('Erro ao exibir detalhes do ticket. Tente novamente.');
    }
  }

  async loadUsuariosPorSetor(setorId) {
    try {
      const selectUsuario = document.getElementById('usuarioDestino');
      selectUsuario.innerHTML = '<option value="">Selecione um usuário</option>';
      
      if (!setorId) return;

      const colaboradores = await this.apiRequest('/colaboradores');
      const colaboradoresDoSetor = colaboradores.filter(c => c.setor_id === setorId && c.ativo === '1');

      colaboradoresDoSetor.forEach(colaborador => {
        const option = document.createElement('option');
        option.value = colaborador.id;
        option.textContent = colaborador.nome;
        selectUsuario.appendChild(option);
      });
    } catch (error) {
      console.error('Erro ao carregar usuários do setor:', error);
      this.showAlert('Erro ao carregar usuários do setor. Tente novamente.');
    }
  }
}

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', () => {
  window.chamadosSystem = new ChamadosSystem();
});