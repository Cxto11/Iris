/* Requires */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpegloc = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
const WebP = require('node-webpmux');

/* Importa módulos */
const Indexer = require('../../index');
const language = require('../../Dialogues/index');

/* JSON's | Utilidades */
let envInfo = JSON.parse(fs.readFileSync(`${__dirname}/utils.json`));
ffmpeg.setFfmpegPath(ffmpegloc.path);

/* Realiza funções de pós finalização */
function postResults(response) {
    /* Verifica se pode resetar a envInfo */
    if (
        envInfo.settings.finish.value === true
        || (envInfo.settings.ender.value === true && envInfo.results.success === false)
    ) {
        /* setTimeout para poder retornar */
        setTimeout(() => {
            /* Reseta a envInfo */
            envInfo.functions.revert.value();

            /* Reseta conforme o tempo */
        }, envInfo.settings.wait.value);
    }

    /* Retorna o resultado de uma função */
    return response;
}

/* Insere o erro na envInfo */
function echoError(error) {
    /* Determina o erro */
    const myError = !(error instanceof Error) ? new Error(`Received a instance of "${typeof error}" in function 'messedup', expected an instance of "Error".`) : error;

    /* Determina o sucesso */
    envInfo.results.success = false;

    /* Determina a falha */
    envInfo.parameters.code.value = myError.code ?? '0';

    /* Determina a mensagem de erro */
    envInfo.parameters.message.value = myError.message ?? 'The operation cannot be completed because an unexpected error occurred.';

    /* Define se pode printar erros */
    if (envInfo.settings.error.value === true) {
        /* Define se vai printar inteiro */
        const showError = config?.fullError?.value || true;

        /* Se pode printar o erro inteiro */
        if (showError) {
            /* Só joga o erro na tela */
            console.error(error);

            /* Se não, formata e printa */
        } else console.log('\x1b[31m', `[${path.basename(__dirname)} #${envInfo.parameters.code.value || 0}] →`, `\x1b[33m${envInfo.parameters.message.value}`);
    }

    /* Retorna o erro */
    return envInfo.results;
}

/* Função que retorna todo o arquivo */
function ambientDetails() {
    /* Retorna a envInfo */
    return envInfo;
}

/* Extrai os frames todos do sticker */
async function extractFrames(inputFile, outputPath, fileName) {
    /* Try - Catch para caso de erro */
    try {
        /* Se a pasta não existir */
        if (!fs.existsSync(outputPath)) {
            /* Cria ela */
            fs.mkdirSync(outputPath);
        }

        /* Cria uma nova webp */
        const img = new WebP.Image();

        /* Carrega a imagem */
        await img.load(inputFile);

        /* Extrai */
        await img.demux({ path: outputPath, prefix: fileName });

        /* Retorna a img */
        return img;

        /* Se der erro */
    } catch (error) {
        /* Retorna o erro */
        return error;
    }
}

/* Converte um bocado de frames em MP4 */
async function makeMP4(inputFolder, fileName, delay = 100) {
    /* Define o nome do arquivo output */
    const outputFile = path.normalize(`${__dirname}/Cache/${Indexer('string').generate(10).value}.mp4`);

    /* Retorna uma Promise, é o meio mais simples de esperar essa conversão terminar */
    return new Promise((resolve) => {
        /* Executa o ffmpeg com os argumentos */
        /* 1FPS = 1000ms */
        (ffmpeg()
            .input(path.normalize(`${inputFolder}/${fileName}_%d.webp`))
            .inputOptions('-framerate', (1000 / delay).toFixed(2))
            .videoCodec('libx264')
            .outputOptions('-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2')
            .outputOptions('-movflags', '+faststart')
            .output(outputFile)

            /* Quando terminar */
            .on('end', () => {
                /* Deleta a pasta de inputs */
                Indexer('clear').destroy(inputFolder);

                /* Define o retorno como o arquivo novo */
                resolve(outputFile);
            })

            /* Se houver erro */
            .on('error', () => {
                /* Deleta a pasta de inputs */
                Indexer('clear').destroy(inputFolder);

                /* Retorna para parar */
                resolve(path.normalize(`${__dirname}/Cache/error.mp4`));
            })

            /* Executa */
            .run()
        );
    });
}

/* Cria a função de comando */
async function stickerConverter(
    kill = envInfo.functions.exec.arguments.kill.value,
    env = envInfo.functions.exec.arguments.env.value,
) {
    /* Define um resultado padrão */
    envInfo.results.value = false;

    /* Define o sucesso */
    envInfo.results.success = false;

    /* Try-Catch para casos de erro */
    try {
        /* Se recebeu tudo corretamente, se der ruim, não fará nada */
        if (typeof kill === 'object' && typeof env === 'object') {
            /* Define os dados necessarios */
            const {
                quoteThis,
                chatId,
                isOwner,
                arks,
                decryptedMedia,
                command,
                isQuotedSticker,
                isQuotedAnimated,
                typeFormatted,
            } = env.value;

            /* Define o alias na envInfo */
            envInfo.alias = env.value.alias;

            /* Menu de ajuda DEV */
            if (arks.includes('--help-dev') && isOwner === true) {
                /* Manda a mensagem de ajuda de dev */
                envInfo.results.value = await kill.sendMessage(chatId, { text: language(region, 'Helper', 'Developer', true, true, envInfo) }, { quoted: quoteThis });

                /* Menu de ajuda normal */
            } else if (arks.includes('--help')) {
                /* Não inclui informações secretas */
                envInfo.results.value = await kill.sendMessage(chatId, { text: language(region, 'Helper', 'User', true, true, envInfo) }, { quoted: quoteThis });

                /* Sistema de conversão, pode não funcionar em webp's transparentes */
            } else if (isQuotedSticker) {
                /* Avisa para esperar, pois depende da velocidade do PC */
                await kill.sendMessage(chatId, { text: language(region, 'Extras', 'Wait', true, true, {}) }, { quoted: quoteThis });

                /* Define como vai tratar a conversão, esse se for imagem comum */
                if (!isQuotedAnimated && command === 'convert') {
                    /* Converte a decrypt para png com sharp */
                    const convertedFile = await sharp(decryptedMedia).toFormat('png').toBuffer();

                    /* Envia como imagem */
                    envInfo.results.value = await kill.sendMessage(
                        chatId,
                        { image: convertedFile, caption: `✏️ By ${config.botName.value} 🖼️` },
                        { quoted: quoteThis },
                    );

                    /* Se não for animado, mas quiser ser ou se for animado */
                } else {
                    /* Define a output place */
                    const outputPlace = path.normalize(`${__dirname}/Cache/${Indexer('string').generate(10).value}`);

                    /* Define o arquivo de MP4 */
                    let sendVideo = path.normalize(`${__dirname}/Cache/error.mp4`);

                    /* Define uma let para hospedar futuros dados */
                    let frameExtractor = false;

                    /* Converte em animado */
                    if (command !== 'convert' && !isQuotedAnimated) {
                        /* Declara o nome do arquivo */
                        const fileConvert = Indexer('string').generate(10).value;
                        const folderConvert = path.normalize(`${__dirname}/Cache/${Indexer('string').generate(10).value}`);
                        const fullPath = path.normalize(`${folderConvert}/${fileConvert}_1.webp`);

                        /* Se a pasta não existir */
                        if (!fs.existsSync(folderConvert)) {
                            /* Cria ela */
                            fs.mkdirSync(folderConvert);
                        }

                        /* Escreve em disco */
                        fs.writeFileSync(fullPath, decryptedMedia);

                        /* Define o arquivo de MP4 */
                        sendVideo = await makeMP4(folderConvert, fileConvert, 100);

                        /* Se for animado */
                    } else {
                        /* Extrai os frames */
                        frameExtractor = await extractFrames(decryptedMedia, outputPlace, 'frame');

                        /* Se não der erro */
                        if (!(frameExtractor instanceof Error)) {
                            /* Define a criação do MP4 */
                            sendVideo = await makeMP4(outputPlace, 'frame', frameExtractor.data.anim.frames[0].delay);
                        }
                    }

                    /* Define as opções de envio */
                    const sendMessage = {
                        video: { url: sendVideo },
                        mimetype: 'video/mp4',
                        caption: (frameExtractor instanceof Error) ? language(region, 'S.E.R', frameExtractor, true, true, {
                            command: 'CONVERT',
                            time: (new Date()).toLocaleString(),
                        }) : `✏️ By ${config.botName.value} 🖼️`,
                    };

                    /* Se for toGif */
                    if (command === 'togif') {
                        /* Envia como GIF */
                        sendMessage.gifPlayback = true;
                    }

                    /* Define o envio do MP4 de erro */
                    envInfo.results.value = await kill.sendMessage(chatId, sendMessage, {
                        quoted: quoteThis,
                    });

                    /* Deleta a output se não deu erro */
                    if (!(frameExtractor instanceof Error) && !sendVideo.endsWith('error.mp4')) {
                        /* Usando o sistema de cleaning */
                        Indexer('clear').destroy(outputPlace);
                        Indexer('clear').destroy(sendVideo);
                    }
                }

                /* Se não for sticker */
            } else {
                /* Pede para usar em um sticker */
                envInfo.results.value = await kill.sendMessage(chatId, { text: language(region, 'Typings', 'Type', true, true, { reqtype: 'sticker', type: typeFormatted }) }, { quoted: quoteThis });
            }
        }

        /*
            Define o sucesso, se seu comando der erro isso jamais será chamado
            Então o success automaticamente será false em falhas
        */
        envInfo.results.success = true;

        /* Caso de algum erro */
    } catch (error) {
        /* Insere tudo na envInfo */
        echoError(error);

        /* Avisa que deu erro, manda o erro e data ao sistema S.E.R (Send/Special Error Report) */
        /* Insira o name que você definiu na envInfo (name) onde pede abaixo */
        await kill.sendMessage(env.value.chatId, {
            text: language(region, 'S.E.R', error, true, true, {
                command: 'CONVERT',
                time: (new Date()).toLocaleString(),
            }),
        }, { quoted: env.value.quoteThis });
    }

    /* Retorna os resultados */
    return postResults(envInfo.results);
}

/* Função que reseta tudo */
function resetAmbient(
    changeKey = {},
) {
    /* Reseta a Success */
    envInfo.results.success = false;

    /* Define o valor padrão */
    let exporting = {
        reset: resetAmbient,
    };

    /* Try-Catch para casos de erro */
    try {
        /* Define a envInfo padrão */
        envInfo = JSON.parse(fs.readFileSync(`${__dirname}/utils.json`));

        /* Define se algum valor deve ser salvo */
        if (Object.keys(changeKey).length !== 0) {
            /* Faz a listagem de keys */
            Object.keys(changeKey).forEach((key) => {
                /* Edita se a key existir */
                if (Object.keys(envInfo).includes(key) && key !== 'developer') {
                    /* Edita a key customizada */
                    envInfo[key] = changeKey[key];
                }
            });
        }

        /* Insere a postResults na envInfo */
        envInfo.functions.poswork.value = postResults;

        /* Insere a ambient na envInfo */
        envInfo.functions.ambient.value = ambientDetails;

        /* Insere a error na envInfo */
        envInfo.functions.messedup.value = echoError;

        /* Insere a revert na envInfo */
        envInfo.functions.revert.value = resetAmbient;

        /* Insere a stickerConverter na envInfo */
        envInfo.functions.exec.value = stickerConverter;

        /* Insere a makeMP4 na envInfo */
        envInfo.functions.tomp4.value = makeMP4;

        /* Insere a extractFrames na envInfo */
        envInfo.functions.extract.value = extractFrames;

        /* Define o local completo na envInfo para usar o reload novamente */
        envInfo.parameters.location.value = __filename;

        /* Gera a module exports */
        module.exports = {
            [envInfo.name]: {
                [envInfo.exports.env]: envInfo.functions.ambient.value,
                [envInfo.exports.messedup]: envInfo.functions.messedup.value,
                [envInfo.exports.poswork]: envInfo.functions.poswork.value,
                [envInfo.exports.reset]: envInfo.functions.revert.value,
                [envInfo.exports.exec]: envInfo.functions.exec.value,
                [envInfo.exports.tomp4]: envInfo.functions.tomp4.value,
                [envInfo.exports.extract]: envInfo.functions.extract.value,
            },
            Developer: 'KillovSky',
            Projects: 'https://github.com/KillovSky',
        };

        /* Determina sucesso */
        envInfo.results.success = true;

        /* Define o valor retornado */
        exporting = module.exports;

        /* Caso de algum erro */
    } catch (error) {
        /* Insere tudo na envInfo */
        echoError(error);
    }

    /* Retorna o exports */
    return exporting;
}

/* Constrói a envInfo */
resetAmbient();
