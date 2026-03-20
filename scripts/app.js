 // ===== VARIÁVEIS GLOBAIS =====
        const firebaseConfig = {
            apiKey: "SUA_API_KEY",
            authDomain: "SEU_AUTH_DOMAIN",
            databaseURL: "https://SEU_PROJECT.firebaseio.com",
            projectId: "SEU_PROJECT",
            storageBucket: "SEU_BUCKET",
            messagingSenderId: "SEU_SENDER_ID",
            appId: "SEU_APP_ID"
        };

        let database, messaging;
        let usuarioAtual = '';
        let motorEstado = 'off';
        let autoMode = true;
        let sensoresAdicionais = [];
        let map;
        let modeloPrevisao;
        let charts = {};

        // ===== FUNÇÕES DE RESPONSIVIDADE =====
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        }

        // ===== FUNÇÕES DE LOGIN =====
        function fazerLogin() {
            const username = document.getElementById('username').value;
            const code = document.getElementById('access-code').value;
            
            if (code === '1234') {
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('dashboard-screen').classList.add('visible');
                document.getElementById('userDisplay').textContent = username || 'Usuário';
                usuarioAtual = username || 'Usuário';
                
                // Ativar página inicial
                document.querySelector('.nav-item[data-page="dashboard"]').classList.add('active');
                
                iniciarFirebase();
                iniciarDashboard();
                iniciarMapa();
                iniciarPrevisaoTempo();
                iniciarModeloIA();
                registrarLog('login', 'Usuário fez login');
            } else {
                alert('Código inválido!');
            }
        }

        function logout() {
            registrarLog('logout', 'Usuário fez logout');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('dashboard-screen').classList.remove('visible');
        }

        // ===== NAVEGAÇÃO CORRIGIDA =====
        function mudarPagina(pagina) {
            // Atualizar menu
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`.nav-item[data-page="${pagina}"]`).classList.add('active');
            
            // Esconder todas as páginas
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // Mostrar página selecionada
            document.getElementById(`page-${pagina}`).classList.add('active');
            
            // Atualizar título
            const titulos = {
                'dashboard': 'Dashboard',
                'graficos': 'Gráficos',
                'dispositivos': 'Dispositivos',
                'alertas': 'Alertas',
                'configuracoes': 'Configurações'
            };
            
            const subtitulos = {
                'dashboard': 'Visão geral do sistema de irrigação',
                'graficos': 'Análise detalhada dos dados coletados',
                'dispositivos': 'Gerenciamento de equipamentos conectados',
                'alertas': 'Histórico de eventos do sistema',
                'configuracoes': 'Personalize seu sistema'
            };
            
            document.getElementById('pageTitle').textContent = titulos[pagina];
            document.getElementById('pageSubtitle').textContent = subtitulos[pagina];
            
            // Fechar sidebar em mobile
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
            
            // Atualizar mapa se necessário
            if (pagina === 'dispositivos' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
            
            // Carregar logs se necessário
            if (pagina === 'alertas') {
                carregarLogs();
            }
        }

        // ===== DATA E HORA =====
        function atualizarDataHora() {
            const agora = new Date();
            document.getElementById('currentDate').textContent = 
                agora.toLocaleDateString('pt-BR');
            document.getElementById('currentTime').textContent = 
                agora.toLocaleTimeString('pt-BR');
        }

        // ===== FIREBASE =====
        function iniciarFirebase() {
            try {
                firebase.initializeApp(firebaseConfig);
                database = firebase.database();
                messaging = firebase.messaging();
                
                // Ouvir dados do ESP32
                database.ref('sensores').on('value', (snapshot) => {
                    const dados = snapshot.val();
                    if (dados) {
                        atualizarDadosFirebase(dados);
                    }
                });
                
                // Verificar falhas periodicamente
                setInterval(verificarFalhas, 30000);
                
            } catch (error) {
                console.error('Erro Firebase:', error);
            }
        }

        // ===== NOTIFICAÇÕES PUSH =====
        function requestNotificationPermission() {
            if (!messaging) return;
            
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    messaging.getToken({ vapidKey: 'SUA_VAPID_KEY' }).then((token) => {
                        console.log('Token FCM:', token);
                        if (database) {
                            database.ref('usuarios/' + usuarioAtual + '/fcmToken').set(token);
                        }
                        addAlert('Notificações ativadas!', 'success');
                    });
                }
            });
        }

        // ===== RECEBER DADOS DO FIREBASE =====
        function atualizarDadosFirebase(dados) {
            // Temperatura
            if (dados.temperatura !== undefined) {
                document.getElementById('tempValue').textContent = dados.temperatura + ' °C';
                document.getElementById('tempProgress').style.width = (dados.temperatura / 40 * 100) + '%';
                document.getElementById('tempStatus').innerHTML = '✓ Online';
                document.getElementById('tempStatus').className = 'sensor-status status-good';
                document.getElementById('configTempStatus').innerHTML = dados.temperatura + '°C';
                document.getElementById('configTempStatus').className = 'status-value online';
            }
            
            // Humidade Ar
            if (dados.humidade !== undefined) {
                document.getElementById('humValue').textContent = dados.humidade + ' %';
                document.getElementById('humProgress').style.width = dados.humidade + '%';
                document.getElementById('humStatus').innerHTML = '✓ Online';
                document.getElementById('humStatus').className = 'sensor-status status-good';
                document.getElementById('configHumStatus').innerHTML = dados.humidade + '%';
                document.getElementById('configHumStatus').className = 'status-value online';
            }
            
            // Solo
            if (dados.solo !== undefined) {
                document.getElementById('soilValue').textContent = dados.solo + ' %';
                document.getElementById('soilProgress').style.width = dados.solo + '%';
                document.getElementById('soilStatus').innerHTML = '✓ Online';
                document.getElementById('soilStatus').className = 'sensor-status status-good';
                document.getElementById('configSoilStatus').innerHTML = dados.solo + '%';
                document.getElementById('configSoilStatus').className = 'status-value online';
            }
            
            // Status do ESP32
            document.getElementById('espStatus').innerHTML = 'Online';
            document.getElementById('espStatus').className = 'status-value online';
            document.getElementById('espStatus2').innerHTML = 'Online';
            document.getElementById('espStatus2').className = 'status-value online';
            document.getElementById('wifiStatus').innerHTML = 'Conectado';
            document.getElementById('wifiStatus').className = 'status-value online';
            document.getElementById('wifiStatus2').innerHTML = 'Conectado';
            document.getElementById('wifiStatus2').className = 'status-value online';
            document.getElementById('ultimaComunicacao').textContent = new Date().toLocaleTimeString();
            
            // Habilitar botões
            document.querySelectorAll('.btn-control').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
            
            // Verificar regras automáticas
            verificarRegrasAuto(dados);
            
            // Treinar modelo com novos dados
            treinarModeloComNovosDados(dados);
            
            // Atualizar gráficos
            atualizarGraficos(dados);
        }

        // ===== ATUALIZAR GRÁFICOS =====
        function atualizarGraficos(dados) {
            const hora = new Date().getHours();
            
            if (charts.mainChart) {
                const datasets = charts.mainChart.data.datasets;
                datasets[0].data[hora] = dados.temperatura;
                datasets[1].data[hora] = dados.humidade;
                datasets[2].data[hora] = dados.solo;
                charts.mainChart.update();
            }
        }

        // ===== VERIFICAR REGRAS AUTOMÁTICAS =====
        function verificarRegrasAuto(dados) {
            const limiteSeco = parseInt(document.getElementById('limiteSeco')?.value || 30);
            const limiteUmido = parseInt(document.getElementById('limiteUmido')?.value || 60);
            
            if (autoMode && motorEstado === 'auto' && dados.solo < limiteSeco) {
                document.getElementById('motorStatusDisplay').textContent = 'Ligando (Auto)';
                document.getElementById('motorStatusDisplay').className = 'status-value online';
                document.getElementById('motorStatusDisplay2').textContent = 'Ligando (Auto)';
                document.getElementById('motorStatusDisplay2').className = 'status-value online';
                addAlert('⚠️ Irrigação automática ligada - solo seco', 'warning');
                registrarLog('motor', 'Irrigação automática ligada (solo seco)');
            } else if (autoMode && motorEstado === 'auto' && dados.solo > limiteUmido) {
                document.getElementById('motorStatusDisplay').textContent = 'Desligado (Auto)';
                document.getElementById('motorStatusDisplay').className = 'status-value offline';
                document.getElementById('motorStatusDisplay2').textContent = 'Desligado (Auto)';
                document.getElementById('motorStatusDisplay2').className = 'status-value offline';
                registrarLog('motor', 'Irrigação automática desligada (solo úmido)');
            }
        }

        // ===== CONTROLE DO MOTOR =====
        function controlarMotor(estado) {
            motorEstado = estado;
            
            document.querySelectorAll('.btn-control').forEach(btn => btn.classList.remove('active'));
            if (estado === 'on') document.querySelector('.btn-control.on').classList.add('active');
            if (estado === 'off') document.querySelector('.btn-control.off').classList.add('active');
            if (estado === 'auto') document.querySelector('.btn-control.auto').classList.add('active');
            
            const motorDisplay = document.getElementById('motorStatusDisplay');
            const motorDisplay2 = document.getElementById('motorStatusDisplay2');
            
            if (estado === 'on') {
                motorDisplay.textContent = 'Ligado';
                motorDisplay.className = 'status-value online';
                motorDisplay2.textContent = 'Ligado';
                motorDisplay2.className = 'status-value online';
                addAlert('Motor ligado manualmente', 'success');
                registrarLog('motor', 'Motor ligado manualmente');
            } else if (estado === 'off') {
                motorDisplay.textContent = 'Desligado';
                motorDisplay.className = 'status-value offline';
                motorDisplay2.textContent = 'Desligado';
                motorDisplay2.className = 'status-value offline';
                addAlert('Motor desligado manualmente', 'info');
                registrarLog('motor', 'Motor desligado manualmente');
            } else {
                motorDisplay.textContent = 'Automático';
                motorDisplay.className = 'status-value online';
                motorDisplay2.textContent = 'Automático';
                motorDisplay2.className = 'status-value online';
                addAlert('Modo automático ativado', 'info');
                registrarLog('motor', 'Modo automático ativado');
            }
            
            // Enviar comando para Firebase
            if (database) {
                database.ref('comandos/motor').set({
                    estado: estado,
                    timestamp: Date.now()
                });
            }
        }

        function toggleAutoMode() {
            const toggle = document.getElementById('autoModeToggle');
            toggle.classList.toggle('active');
            autoMode = toggle.classList.contains('active');
            registrarLog('config', 'Modo automático: ' + (autoMode ? 'ativado' : 'desativado'));
        }

        // ===== MODO ESCURO =====
        function toggleDarkMode() {
            const toggle = document.getElementById('darkModeToggle');
            toggle.classList.toggle('active');
            
            if (toggle.classList.contains('active')) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                registrarLog('config', 'Modo escuro ativado');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                registrarLog('config', 'Modo claro ativado');
            }
        }

        // ===== MAPA =====
        function iniciarMapa() {
            map = L.map('map').setView([-15.1167, 39.2667], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);
            
            // Adicionar marcador do ESP32
            L.marker([-15.1167, 39.2667]).addTo(map)
                .bindPopup('<b>ESP32</b><br>Aguardando dados...');
        }

        function adicionarMarcadorSensor(lat, lng, nome, valor, unidade) {
            L.marker([lat, lng]).addTo(map)
                .bindPopup(`<b>${nome}</b><br>Valor: ${valor}${unidade}`);
        }

        // ===== PREVISÃO DO TEMPO =====
        async function iniciarPrevisaoTempo() {
            const apiKey = 'ca50095dd2e55f8a7fff4b1c5db19763';
            
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&units=metric&lang=pt_br&appid=${apiKey}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    document.getElementById('previsaoConteudo').innerHTML = `
                        <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" style="width: 50px;">
                        <div>
                            <strong>${data.main.temp}°C</strong> - ${data.weather[0].description}<br>
                            <small>Umidade: ${data.main.humidity}% | Vento: ${data.wind.speed} m/s</small>
                        </div>
                    `;
                } catch (error) {
                    document.getElementById('previsaoConteudo').innerHTML = 'Erro ao carregar previsão';
                }
            }, () => {
                document.getElementById('previsaoConteudo').innerHTML = 'Permita o acesso à localização';
            });
        }

        // ===== CONTROLE POR VOZ =====
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition;

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.continuous = false;
            recognition.interimResults = false;
        }

        function iniciarEscuta() {
            if (!recognition) {
                alert('Seu navegador não suporta comando de voz');
                return;
            }
            
            const btn = document.querySelector('.voice-btn');
            btn.classList.add('listening');
            btn.innerHTML = '<i class="fas fa-microphone"></i> <span>Ouvindo...</span>';
            
            recognition.start();

            recognition.onresult = (event) => {
                const comando = event.results[0][0].transcript.toLowerCase();
                btn.classList.remove('listening');
                btn.innerHTML = '<i class="fas fa-microphone"></i> <span>Comando de Voz</span>';
                
                if (comando.includes('ligar motor')) {
                    controlarMotor('on');
                    addAlert('Comando de voz: Ligar motor', 'success');
                } else if (comando.includes('desligar motor')) {
                    controlarMotor('off');
                    addAlert('Comando de voz: Desligar motor', 'success');
                } else if (comando.includes('modo automático')) {
                    controlarMotor('auto');
                    addAlert('Comando de voz: Modo automático', 'success');
                } else if (comando.includes('modo escuro')) {
                    if (!document.getElementById('darkModeToggle').classList.contains('active')) {
                        toggleDarkMode();
                    }
                    addAlert('Comando de voz: Modo escuro ativado', 'success');
                } else if (comando.includes('modo claro')) {
                    if (document.getElementById('darkModeToggle').classList.contains('active')) {
                        toggleDarkMode();
                    }
                    addAlert('Comando de voz: Modo claro ativado', 'success');
                } else {
                    addAlert('Comando não reconhecido: ' + comando, 'warning');
                }
            };

            recognition.onerror = () => {
                btn.classList.remove('listening');
                btn.innerHTML = '<i class="fas fa-microphone"></i> <span>Comando de Voz</span>';
            };

            recognition.onend = () => {
                btn.classList.remove('listening');
                btn.innerHTML = '<i class="fas fa-microphone"></i> <span>Comando de Voz</span>';
            };
        }

        // ===== INTELIGÊNCIA ARTIFICIAL =====
        async function iniciarModeloIA() {
            modeloPrevisao = tf.sequential();
            modeloPrevisao.add(tf.layers.dense({ units: 10, inputShape: [1], activation: 'relu' }));
            modeloPrevisao.add(tf.layers.dense({ units: 1 }));
            modeloPrevisao.compile({ loss: 'meanSquaredError', optimizer: 'adam' });
        }

        async function treinarModeloComNovosDados(dados) {
            if (!modeloPrevisao || !dados.solo) return;
            
            const historico = [];
            if (database) {
                const snapshot = await database.ref('historico').limitToLast(10).once('value');
                snapshot.forEach(child => {
                    historico.push(child.val().solo);
                });
            }
            
            if (historico.length > 5) {
                try {
                    const xs = tf.tensor2d(historico.slice(0, -1).map((_, i) => [i]), [historico.length - 1, 1]);
                    const ys = tf.tensor2d(historico.slice(1), [historico.length - 1, 1]);
                    await modeloPrevisao.fit(xs, ys, { epochs: 50 });
                    
                    const previsao = modeloPrevisao.predict(tf.tensor2d([[historico.length]], [1, 1]));
                    const valorPrevisto = previsao.dataSync()[0];
                    
                    document.getElementById('previsaoSolo').innerHTML = 
                        `📈 Previsão próxima leitura: ${valorPrevisto.toFixed(1)}%`;
                } catch (e) {
                    console.log('Erro no treinamento:', e);
                }
            }
        }

        // ===== LOGS DE EVENTOS =====
        function registrarLog(acao, detalhes) {
            if (!database) return;
            
            const logRef = database.ref('logs').push();
            logRef.set({
                timestamp: Date.now(),
                usuario: usuarioAtual,
                acao: acao,
                detalhes: detalhes
            });
        }

        function carregarLogs() {
            if (!database) return;
            
            const data = document.getElementById('filtroData').value;
            const acao = document.getElementById('filtroAcao').value;
            
            database.ref('logs').orderByChild('timestamp').limitToLast(100).once('value', (snapshot) => {
                const logsLista = document.getElementById('logsLista');
                logsLista.innerHTML = '';
                
                let logsArray = [];
                snapshot.forEach(child => {
                    logsArray.push(child.val());
                });
                
                logsArray.reverse();
                
                logsArray.forEach(log => {
                    if (data) {
                        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                        if (logDate !== data) return;
                    }
                    
                    if (acao && log.acao !== acao) return;
                    
                    const dataHora = new Date(log.timestamp).toLocaleString('pt-BR');
                    const logItem = document.createElement('div');
                    logItem.className = 'alert-item';
                    
                    let iconClass = 'success';
                    let icon = 'info-circle';
                    
                    if (log.acao === 'alerta' || log.acao === 'motor') {
                        iconClass = 'warning';
                        icon = 'exclamation-triangle';
                    } else if (log.acao === 'login' || log.acao === 'logout') {
                        iconClass = 'success';
                        icon = 'sign-in-alt';
                    }
                    
                    logItem.innerHTML = `
                        <div class="alert-icon ${iconClass}">
                            <i class="fas fa-${icon}"></i>
                        </div>
                        <div style="flex: 1;">
                            <strong>${log.acao.toUpperCase()}</strong> - ${log.detalhes}
                        </div>
                        <small>${dataHora}</small>
                    `;
                    
                    logsLista.appendChild(logItem);
                });
                
                if (logsArray.length === 0) {
                    logsLista.innerHTML = '<div class="alert-item">Nenhum log encontrado</div>';
                }
            });
        }

        function limparFiltros() {
            document.getElementById('filtroData').value = '';
            document.getElementById('filtroAcao').value = '';
            carregarLogs();
        }

        // ===== VERIFICAR FALHAS =====
        function verificarFalhas() {
            if (!database) return;
            
            const ultimaComunicacao = document.getElementById('ultimaComunicacao').textContent;
            if (ultimaComunicacao !== '---') {
                const agora = new Date();
                const [horas, minutos, segundos] = ultimaComunicacao.split(':');
                const ultima = new Date();
                ultima.setHours(parseInt(horas), parseInt(minutos), parseInt(segundos));
                
                const diff = (agora - ultima) / 1000 / 60;
                
                if (diff > 5) {
                    document.getElementById('espStatus').innerHTML = 'Offline (falha)';
                    document.getElementById('espStatus').className = 'status-value offline';
                    document.getElementById('espStatus2').innerHTML = 'Offline (falha)';
                    document.getElementById('espStatus2').className = 'status-value offline';
                    document.getElementById('wifiStatus').innerHTML = 'Desconectado';
                    document.getElementById('wifiStatus').className = 'status-value offline';
                    document.getElementById('wifiStatus2').innerHTML = 'Desconectado';
                    document.getElementById('wifiStatus2').className = 'status-value offline';
                    
                    addAlert('⚠️ ESP32 sem comunicação! Verifique a conexão.', 'danger');
                    registrarLog('alerta', 'ESP32 offline por mais de 5 minutos');
                }
            }
        }

        // ===== ADICIONAR ALERTA =====
        function addAlert(mensagem, tipo) {
            const alertasLista = document.getElementById('alertasLista');
            if (!alertasLista) return;
            
            const agora = new Date();
            const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const alertItem = document.createElement('div');
            alertItem.className = 'alert-item';
            alertItem.innerHTML = `
                <div class="alert-icon ${tipo}">
                    <i class="fas fa-${tipo === 'danger' ? 'exclamation-triangle' : tipo === 'warning' ? 'exclamation' : 'info-circle'}"></i>
                </div>
                <div style="flex: 1;">${mensagem}</div>
                <small>${hora}</small>
            `;
            
            alertasLista.insertBefore(alertItem, alertasLista.firstChild);
            
            if (alertasLista.children.length > 10) {
                alertasLista.removeChild(alertasLista.lastChild);
            }
            
            registrarLog('alerta', mensagem);
        }

        // ===== ADICIONAR SENSORES =====
        function mostrarFormSensor() {
            document.getElementById('novoSensorForm').style.display = 'block';
        }

        function cancelarAdicionarSensor() {
            document.getElementById('novoSensorForm').style.display = 'none';
        }

        function adicionarSensor() {
            const tipo = document.getElementById('tipoSensor').value;
            const nome = document.getElementById('nomeSensor').value || 'Novo Sensor';
            const gpio = document.getElementById('gpioSensor').value || '0';
            const unidade = document.getElementById('unidadeSensor').value;
            const lat = parseFloat(document.getElementById('latSensor').value) || -23.5505;
            const lng = parseFloat(document.getElementById('lngSensor').value) || -46.6333;
            const icone = document.getElementById('iconeSensor').value;
            
            const novoSensor = {
                tipo,
                nome,
                gpio,
                unidade,
                lat,
                lng,
                icone,
                id: Date.now()
            };
            
            sensoresAdicionais.push(novoSensor);
            
            // Adicionar à lista na página configurações
            const lista = document.getElementById('sensores-lista');
            const sensorDiv = document.createElement('div');
            sensorDiv.className = 'setting-item';
            sensorDiv.id = `sensor-${novoSensor.id}`;
            sensorDiv.innerHTML = `
                <div class="setting-info">
                    <strong><i class="fas ${icone}"></i> ${nome}</strong>
                    <small>GPIO ${gpio} · Aguardando dados</small>
                </div>
                <span class="status-value waiting">Aguardando</span>
            `;
            lista.appendChild(sensorDiv);
            
            // Adicionar à página dispositivos
            const dispositivosLista = document.getElementById('sensoresAdicionaisLista');
            const dispositivoDiv = document.createElement('div');
            dispositivoDiv.className = 'status-item';
            dispositivoDiv.id = `disp-sensor-${novoSensor.id}`;
            dispositivoDiv.innerHTML = `
                <span><i class="fas ${icone}"></i> ${nome}:</span>
                <span class="status-value waiting">Aguardando</span>
            `;
            dispositivosLista.appendChild(dispositivoDiv);
            
            // Adicionar marcador no mapa
            adicionarMarcadorSensor(lat, lng, nome, '--', unidade);
            
            // Salvar no Firebase
            if (database) {
                database.ref('sensores_config/' + novoSensor.id).set(novoSensor);
            }
            
            registrarLog('config', 'Novo sensor adicionado: ' + nome);
            addAlert('Sensor ' + nome + ' adicionado com sucesso!', 'success');
            
            document.getElementById('novoSensorForm').style.display = 'none';
            
            document.getElementById('nomeSensor').value = '';
            document.getElementById('gpioSensor').value = '';
            document.getElementById('latSensor').value = '';
            document.getElementById('lngSensor').value = '';
        }

        // ===== BACKUP E EXPORTAÇÃO =====
        function exportarDados() {
            if (!database) {
                alert('Firebase não configurado');
                return;
            }
            
            database.ref('historico').limitToLast(100).once('value', (snapshot) => {
                const dados = [];
                snapshot.forEach(child => {
                    dados.push(child.val());
                });
                
                const headers = ['Data/Hora', 'Temperatura', 'Humidade Ar', 'Humidade Solo'];
                const csvRows = [];
                csvRows.push(headers.join(','));
                
                dados.forEach(d => {
                    const row = [
                        new Date(d.timestamp).toLocaleString('pt-BR'),
                        d.temperatura || '',
                        d.humidade || '',
                        d.solo || ''
                    ];
                    csvRows.push(row.join(','));
                });
                
                const csvString = csvRows.join('\n');
                const blob = new Blob([csvString], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `terraflow_dados_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                
                addAlert('Dados exportados com sucesso', 'success');
                registrarLog('export', 'Dados exportados para CSV');
            });
        }

        function fazerBackup() {
            const backup = {
                data: new Date().toISOString(),
                usuario: usuarioAtual,
                configuracoes: {
                    autoMode: autoMode,
                    limiteSeco: document.getElementById('limiteSeco')?.value,
                    limiteUmido: document.getElementById('limiteUmido')?.value,
                    tema: localStorage.getItem('theme') || 'light'
                },
                sensores: sensoresAdicionais
            };
            
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `terraflow_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            addAlert('Backup realizado com sucesso', 'success');
            registrarLog('backup', 'Backup do sistema realizado');
        }

        function reiniciarESP32() {
            if (confirm('Tem certeza que deseja reiniciar o ESP32?')) {
                if (database) {
                    database.ref('comandos/restart').set({
                        timestamp: Date.now(),
                        comando: 'reiniciar'
                    });
                }
                addAlert('Comando de reinicialização enviado', 'warning');
                registrarLog('sistema', 'Comando de reinicialização do ESP32 enviado');
            }
        }

        // ===== INICIALIZAÇÃO =====
        function iniciarDashboard() {
            atualizarDataHora();
            setInterval(atualizarDataHora, 1000);
            
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.getElementById('darkModeToggle').classList.add('active');
            }
            
            iniciarGraficos();
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').catch(() => {});
            }
            
            setTimeout(carregarLogs, 2000);
        }

        function iniciarGraficos() {
            const labels = Array.from({length: 24}, (_, i) => i + ':00');
            
            const ctx = document.getElementById('mainChart').getContext('2d');
            charts.mainChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { 
                            label: 'Temperatura (°C)', 
                            data: Array(24).fill(null), 
                            borderColor: '#ff6b6b',
                            backgroundColor: 'rgba(255,107,107,0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        { 
                            label: 'Humidade Ar (%)', 
                            data: Array(24).fill(null), 
                            borderColor: '#4a90e2',
                            backgroundColor: 'rgba(74,144,226,0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        { 
                            label: 'Humidade Solo (%)', 
                            data: Array(24).fill(null), 
                            borderColor: '#2ecc71',
                            backgroundColor: 'rgba(46,204,113,0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { 
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                            }
                        }
                    }
                }
            });

            const tempCtx = document.getElementById('tempChart').getContext('2d');
            charts.tempChart = new Chart(tempCtx, {
                type: 'line',
                data: { 
                    labels, 
                    datasets: [{ 
                        label: 'Temperatura (°C)', 
                        data: Array(24).fill(null), 
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255,107,107,0.1)',
                        tension: 0.4,
                        fill: true
                    }] 
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            
            const humCtx = document.getElementById('humChart').getContext('2d');
            charts.humChart = new Chart(humCtx, {
                type: 'line',
                data: { 
                    labels, 
                    datasets: [{ 
                        label: 'Humidade Ar (%)', 
                        data: Array(24).fill(null), 
                        borderColor: '#4a90e2',
                        backgroundColor: 'rgba(74,144,226,0.1)',
                        tension: 0.4,
                        fill: true
                    }] 
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            
            const soilCtx = document.getElementById('soilChart').getContext('2d');
            charts.soilChart = new Chart(soilCtx, {
                type: 'line',
                data: { 
                    labels, 
                    datasets: [{ 
                        label: 'Humidade Solo (%)', 
                        data: Array(24).fill(null), 
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46,204,113,0.1)',
                        tension: 0.4,
                        fill: true
                    }] 
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // ===== INICIALIZAR =====
        window.onload = function() {
            document.getElementById('access-code').value = '1234';
            
            window.addEventListener('resize', function() {
                if (window.innerWidth > 768) {
                    document.getElementById('sidebar').classList.remove('open');
                    document.querySelector('.sidebar-overlay').classList.remove('active');
                }
            });
        };