# SILVA XVI Audio Comparer

Aplicativo desktop para Windows com uma interface Dark Studio e uma primeira camada de treino vocal. O motor de áudio usa Web Audio/MediaDevices do Chromium empacotado pelo Electron; a enumeração, captura de microfone e saída selecionada ficam encapsuladas em `src/audio-engine.ts`.

## Executar

Requer Node.js 20 ou superior.

```powershell
npm install
npm run dev
```

Para validar a versão de produção, rode `npm run build`; `npm start` abre `dist/index.html`.

## Instalador Windows

Em Windows x64, gere o instalador NSIS com:

```powershell
npm run package:win
```

Cada execução de `npm run package:win` incrementa automaticamente a versão de patch, compila e gera o instalador. O artefato versionado fica em `release/` e é copiado para `UPDATE/`; `UPDATE/ULTIMA_VERSAO.txt` identifica a versão mais recente. Os instaladores anteriores são mantidos em `UPDATE/` para permitir identificar e recuperar versões. O instalador permite escolher a pasta, cria atalhos no Menu Iniciar e na área de trabalho e preserva os dados do usuário ao desinstalar.

## Versão PWA e GitHub Pages

O mesmo app também pode ser instalado como PWA em navegadores compatíveis. O build cria ícones, manifesto e service worker para instalação e uso offline após o primeiro carregamento. Quando uma atualização é publicada, o app informa que existe nova versão e oferece o botão **Atualizar app**, evitando recarregar uma sessão sem consentimento.

`npm run build:pwa` gera o site em `dist/`. O workflow `.github/workflows/pages.yml` publica automaticamente esse diretório no GitHub Pages a cada push para `main` ou `master`; cada deploy usa o commit como identificador do cache do PWA, então as alterações novas são detectadas mesmo sem trocar o número de versão do instalador Windows. Para ativar a publicação, envie este projeto a um repositório GitHub e, em **Settings > Pages**, selecione **GitHub Actions** como origem. O endereço será `https://<usuario>.github.io/<repositorio>/` (ou o domínio configurado no repositório).

## Fluxos disponíveis

- Seleção independente de entrada e saída, com opção de seguir o dispositivo padrão do Windows.
- Atualização de dispositivos em tempo real; desconexões mantêm a seleção preferida, encerram a captura inválida sem fechar o app e exibem o estado.
- Teste de microfone com medidor e estimativa de nota/frequência; estimativa destacada da nota/frequência da referência durante a reprodução; teste da saída com tom de 440 Hz.
- Afinador cromático de instrumentos no menu, com referência Lá configurável e indicador de cents.
- Histórico visual das notas detectadas na referência e no microfone, alinhado à linha do tempo durante a reprodução.
- Separador de centro estéreo para destacar vocais centralizados ou reduzi-los e ouvir elementos laterais.
- Monitoramento real da entrada com volume separado, ganho/pan/mute/solo para voz e referência, além de volume master.
- Importação e reprodução de áudio, forma de onda, busca por clique, zoom e controle de velocidade com preservação de pitch quando suportada pelo Chromium.
- Atalhos de espaço para reproduzir/pausar e layout adaptável a janelas menores.

## Limites técnicos deste MVP

O motor de áudio do navegador não oferece controle de buffer WASAPI/ASIO, nem consulta uniforme às taxas/canais suportados por cada driver. A taxa selecionada é solicitada ao `AudioContext`; a taxa realmente aberta aparece na barra inferior. A alteração de taxa após abrir o motor exige reiniciar o app. O valor de buffer e latência é uma estimativa de referência, não um ajuste nem medição do buffer físico. A análise de pitch em tempo real é monofônica e experimental. Gravação, detecção automática de microfonia, transposição da faixa, alinhamento de pitch original, loop A-B, seleção multipista e roteamento multicanal ficam para etapas posteriores. O app não promete monitoramento de latência ultrabaixa nem compatibilidade ASIO.

O separador usa soma/diferença dos canais estéreo (mid/side), não inteligência artificial: funciona melhor quando os vocais estão centralizados e não separa instrumentos que compartilham a mesma posição/fase. Faixas mono não oferecem os modos de separação. O monitoramento não conecta a entrada à saída por padrão. Ative-o conscientemente e prefira fones para reduzir risco de realimentação.
