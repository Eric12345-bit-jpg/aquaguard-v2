// AquaGuard localization catalog. This module is dependency-free and safe to import
// from both Node (API/AI) and the browser (dashboard).
export const LANGUAGES = Object.freeze([
  { code: "en", label: "English" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "fr", label: "Français" },
  { code: "sw", label: "Kiswahili" },
  { code: "zh", label: "中文" },
  { code: "nl", label: "Nederlands" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" }
]);

const messages = {
  en: {
    ui: { insights: "AI insights", health: "Device health", language: "Language", offline: "Offline dashboard", localization: "Likely affected section", noExactPoint: "Flow-only sensors identify the section between the sensors; they cannot locate a point within it.", status: "System status", updated: "Updated", internetLost: "Internet connection has been unavailable for 2 minutes.", enterOffline: "Open local offline dashboard", localOnly: "Local device view" },
    learning: ["Learning normal behaviour", "Collected {n} of {min} readings needed for baseline analysis."],
    implausible_flow: ["Flow value outside configured range", "A flow reading exceeded {max} L/min and was rejected as implausible. Check calibration, pulse wiring, and sensor noise."],
    valve_closed_flow: ["Valve state conflicts with flow", "The controller reports the valve closed while inlet flow is about {flow} L/min. Verify relay/valve polarity and check for residual flow or sensor noise."],
    leak_pattern: ["Water loss above learned baseline", "Estimated inlet-minus-outlet loss is {loss} L/min (baseline {baseline} L/min). The monitored section between the two flow sensors is suspect."],
    loss_always_high: ["Persistent flow imbalance", "Loss is {loss} L/min and resembles the learned baseline ({baseline} L/min). Check sensor calibration and plumbing before treating this as a new leak."],
    negative_loss: ["Outlet exceeds inlet", "Outlet flow is about {excess} L/min above inlet. Check both sensor calibrations, placement, and flow direction."],
    tank_dropping: ["Tank level is falling", "Ultrasonic distance is increasing by about {slope} cm/min. Check the tank and its supply."],
    level_missing: ["Tank echo often missing", "At least half of recent tank-distance samples are missing. Check sensor power, wiring, mounting, and the echo voltage divider."],
    sensor_stuck: ["Inlet sensor may be stuck", "The inlet flow reading has not changed over 90 samples. Inspect the sensor and signal wire."],
    offline: ["Controller offline", "No current controller telemetry is available. The displayed cloud values are zeroed and are not current measurements."],
    stale_readings: ["Telemetry is stale", "The latest controller reading is older than the configured online window."],
    internet_outage: ["Internet connection lost", "The controller could not reach its configured cloud endpoint for 2 minutes. Local leak protection continues on the ESP32."],
    internet_restored: ["Internet connection restored", "The controller can reach its configured cloud endpoint again."],
    device_restored: ["Controller connection restored", "The ESP32 controller is sending telemetry again."],
    outlet_node_offline: ["Outlet sensor link unavailable", "The ESP32 has not received a fresh authenticated outlet reading. Flow-loss comparison is suspended and the configured safety response is active."],
    localization: ["Section between inlet and outlet flow sensors", "Exact position cannot be inferred from two flow readings alone."],
    data_invalid: ["Invalid telemetry rejected", "One or more readings exceeded validation limits and were not stored as sensor measurements."]
    ,normal: ["No current anomaly", "Current validated readings are within configured flow and health limits; continue routine monitoring."]
  },
  rw: {
    ui: { insights: "Inama za AI", health: "Imiterere y'ibikoresho", language: "Ururimi", offline: "Imbonerahamwe yo kuri local", localization: "Igice gishobora kugira ikibazo", noExactPoint: "Ibyuma bipima flow bigaragaza igice kiri hagati yabyo gusa; ntibishobora kwerekana aho leak iri muri icyo gice.", status: "Imiterere ya sisitemu", updated: "Byavuguruwe", internetLost: "Internet imaze iminota 2 idakora.", enterOffline: "Fungura dashboard ya local", localOnly: "Ibyerekanwa n'igikoresho" },
    learning: ["Sisitemu iracyiga imikoreshereze isanzwe", "Harakusanyijwe {n} muri {min} readings zikenewe ngo isesengura ritangire."],
    implausible_flow: ["Flow iri hanze y'igipimo cyemewe", "Flow ya {max} L/min yarenze igipimo, ntiyemerewe. Reba calibration, insinga za pulses n'urusaku."],
    valve_closed_flow: ["Imiterere ya valve ntihuye na flow", "Controller ivuga ko valve ifunze ariko inlet iri hafi ya {flow} L/min. Reba relay, icyerekezo cya valve n'urusaku rwa sensor."],
    leak_pattern: ["Amazi abura arenze ibisanzwe", "Igihombo cya inlet ugereranyije na outlet ni {loss} L/min (ibisanzwe {baseline} L/min). Igice kiri hagati ya sensors gishobora kuba gifite ikibazo."],
    loss_always_high: ["Itandukaniro rya flow rikomeje", "Loss ni {loss} L/min kandi isa n'ibyari bisanzwe ({baseline} L/min). Banza ugenzure calibration n'imiyoboro."],
    negative_loss: ["Outlet iruta inlet", "Outlet iruta inlet hafi ya {excess} L/min. Reba calibration, aho sensors ziri n'icyerekezo cy'amazi."],
    tank_dropping: ["Amazi yo muri tank aragabanuka", "Intera ya ultrasonic yiyongera hafi ya {slope} cm ku munota. Reba tank n'umuyoboro uyigaburira."],
    level_missing: ["Ultrasonic ibura echo kenshi", "Nibura kimwe cya kabiri cy'ibipimo bya tank biheruka ntibifite echo. Reba amashanyarazi, insinga n'uko sensor ihagaze."],
    sensor_stuck: ["Sensor ya inlet ishobora kuba yarahagaze", "Flow ya inlet ntiyahindutse mu bipimo 90. Reba sensor n'insinga zayo."],
    offline: ["Controller ntiri kuri internet", "Nta telemetry nshya ihari. Imibare ya cloud yerekanwa nka zeru, si ibipimo bishya."],
    stale_readings: ["Amakuru ashaje", "Reading iheruka irengeje igihe ntarengwa cyo kwitwa online."],
    internet_outage: ["Internet yabuze", "ESP32 imaze iminota 2 itagera kuri cloud. Kurinda leak kuri ESP32 birakomeza."],
    internet_restored: ["Internet yagarutse", "Controller yongeye kugera kuri cloud."],
    device_restored: ["Controller yongeye kohereza amakuru", "ESP32 yongeye kohereza telemetry."],
    outlet_node_offline: ["ESP8266 ntiri kohereza amakuru", "ESP32 ntiyabonye reading nshya ya outlet. Kugereranya flow byahagaritswe kandi igikorwa cyo kwirinda cyakozwe."],
    localization: ["Igice kiri hagati ya inlet na outlet sensors", "Ibipimo bibiri bya flow ntibishobora kwerekana aho leak iri neza."],
    data_invalid: ["Telemetry itemewe yanze kubikwa", "Reading imwe cyangwa nyinshi zirenze igipimo ntarengwa; ntizabitswe nk'ibipimo." ]
    ,normal: ["Nta kibazo kigaragara ubu", "Ibipimo byemewe biri mu bipimo bya flow n'ubuzima bw'ibikoresho; komeza gukurikirana." ]
  },
  fr: {
    ui: { insights: "Analyses IA", health: "État des appareils", language: "Langue", offline: "Tableau de bord hors ligne", localization: "Section probablement concernée", noExactPoint: "Les débitmètres indiquent seulement la section entre eux; ils ne localisent pas un point précis.", status: "État du système", updated: "Mis à jour", internetLost: "Connexion Internet indisponible depuis 2 minutes.", enterOffline: "Ouvrir le tableau de bord local", localOnly: "Vue de l'appareil" },
    learning: ["Apprentissage du fonctionnement normal", "{n} mesures sur {min} nécessaires à l'analyse de référence ont été recueillies."],
    implausible_flow: ["Débit hors plage configurée", "Un débit de {max} L/min a dépassé la limite et a été rejeté. Vérifiez l'étalonnage, les impulsions et le bruit électrique."],
    valve_closed_flow: ["État de vanne incohérent avec le débit", "Le contrôleur indique une vanne fermée alors que l'entrée mesure environ {flow} L/min. Vérifiez la polarité du relais et le capteur."],
    leak_pattern: ["Perte d'eau supérieure à la référence", "La perte entrée-sortie estimée est de {loss} L/min (référence {baseline} L/min). La section entre les deux débitmètres est suspecte."],
    loss_always_high: ["Déséquilibre persistant", "La perte est de {loss} L/min, proche de la référence ({baseline} L/min). Vérifiez l'étalonnage et la plomberie."],
    negative_loss: ["La sortie dépasse l'entrée", "Le débit de sortie dépasse l'entrée d'environ {excess} L/min. Vérifiez l'étalonnage et le sens d'écoulement."],
    tank_dropping: ["Le niveau du réservoir baisse", "La distance ultrasonique augmente d'environ {slope} cm/min. Vérifiez le réservoir et son alimentation."],
    level_missing: ["Échos ultrasoniques souvent absents", "Au moins la moitié des mesures récentes du réservoir sont manquantes. Vérifiez l'alimentation, le câblage et le montage."],
    sensor_stuck: ["Le capteur d'entrée semble bloqué", "Le débit d'entrée n'a pas changé pendant 90 mesures. Inspectez le capteur et son fil."],
    offline: ["Contrôleur hors ligne", "Aucune télémétrie actuelle n'est disponible. Les valeurs cloud affichées sont mises à zéro et ne sont pas des mesures actuelles."],
    stale_readings: ["Télémétrie obsolète", "La dernière mesure dépasse le délai configuré pour l'état en ligne."],
    internet_outage: ["Connexion Internet perdue", "Le contrôleur ne joint plus le cloud depuis 2 minutes. La protection locale ESP32 continue."],
    internet_restored: ["Connexion Internet rétablie", "Le contrôleur peut de nouveau joindre son point cloud."],
    device_restored: ["Contrôleur rétabli", "Le contrôleur ESP32 transmet de nouveau les mesures."],
    outlet_node_offline: ["Liaison du capteur de sortie indisponible", "L'ESP32 n'a pas reçu de nouvelle mesure authentifiée. La comparaison des débits est suspendue."],
    localization: ["Section entre les débitmètres d'entrée et de sortie", "Deux mesures de débit ne permettent pas d'inférer un point précis."],
    data_invalid: ["Télémétrie invalide rejetée", "Une mesure a dépassé les limites de validation et n'a pas été stockée comme mesure valide."]
    ,normal: ["Aucune anomalie actuelle", "Les mesures validées respectent les limites configurées; poursuivez la surveillance."]
  },
  sw: {
    ui: { insights: "Uchambuzi wa AI", health: "Hali ya vifaa", language: "Lugha", offline: "Dashibodi ya nje ya mtandao", localization: "Sehemu inayoshukiwa", noExactPoint: "Vipima-mtiririko vinaonyesha sehemu kati yao pekee; haviwezi kubaini sehemu halisi ya uvujaji.", status: "Hali ya mfumo", updated: "Imesasishwa", internetLost: "Muunganisho wa intaneti haupatikani kwa dakika 2.", enterOffline: "Fungua dashibodi ya ndani", localOnly: "Mwonekano wa kifaa" },
    learning: ["Inajifunza matumizi ya kawaida", "Imekusanya vipimo {n} kati ya {min} vinavyohitajika kwa uchambuzi wa msingi."],
    implausible_flow: ["Mtiririko uko nje ya kiwango", "Kipimo cha {max} L/min kimezidi kikomo na kukataliwa. Kagua urekebishaji, nyaya za pulse na kelele."],
    valve_closed_flow: ["Hali ya vali haiendani na mtiririko", "Kidhibiti kinasema vali imefungwa lakini inlet ni karibu {flow} L/min. Kagua relay na sensor."],
    leak_pattern: ["Upotevu wa maji umezidi kiwango cha kawaida", "Upotevu wa inlet ukilinganishwa na outlet ni {loss} L/min (kawaida {baseline} L/min). Sehemu kati ya vipima-mtiririko inashukiwa."],
    loss_always_high: ["Tofauti ya mtiririko inaendelea", "Upotevu ni {loss} L/min, sawa na msingi ({baseline} L/min). Kagua urekebishaji na mabomba."],
    negative_loss: ["Outlet ni kubwa kuliko inlet", "Mtiririko wa outlet unazidi inlet kwa karibu {excess} L/min. Kagua urekebishaji na mwelekeo wa maji."],
    tank_dropping: ["Kiwango cha tanki kinashuka", "Umbali wa ultrasonic unaongezeka takriban {slope} cm kwa dakika. Kagua tanki na bomba lake."],
    level_missing: ["Echo ya tanki inakosekana mara nyingi", "Angalau nusu ya vipimo vya tanki havina echo. Kagua umeme, nyaya na mahali sensor ilipo."],
    sensor_stuck: ["Sensor ya inlet inaweza kukwama", "Mtiririko wa inlet haujabadilika katika vipimo 90. Kagua sensor na waya."],
    offline: ["Kidhibiti hakipo mtandaoni", "Hakuna data ya sasa. Thamani za cloud zimewekwa sifuri na si vipimo vya sasa."],
    stale_readings: ["Data imepitwa na wakati", "Kipimo cha mwisho ni cha zamani kuliko muda wa kuwa online."],
    internet_outage: ["Intaneti imekatika", "Kidhibiti hakijafikia cloud kwa dakika 2. Ulinzi wa ndani wa ESP32 unaendelea."],
    internet_restored: ["Intaneti imerejea", "Kidhibiti kinaweza tena kufikia cloud."],
    device_restored: ["Kidhibiti kimerudi", "ESP32 inatuma data tena."],
    outlet_node_offline: ["Muunganisho wa sensor ya outlet haupatikani", "ESP32 haijapokea kipimo kipya kilichothibitishwa. Ulinganisho wa mtiririko umesimamishwa."],
    localization: ["Sehemu kati ya vipima-mtiririko vya inlet na outlet", "Vipimo viwili vya mtiririko haviwezi kubaini mahali halisi."],
    data_invalid: ["Data isiyo sahihi imekataliwa", "Kipimo kimezidi mipaka ya uthibitishaji na hakikuhifadhiwa kama kipimo halali."]
    ,normal: ["Hakuna hitilafu kwa sasa", "Vipimo halali viko ndani ya viwango vilivyowekwa; endelea kufuatilia."]
  },
  zh: {
    ui: { insights: "AI 洞察", health: "设备健康", language: "语言", offline: "离线仪表板", localization: "可能受影响的管段", noExactPoint: "流量传感器只能识别两者之间的管段，不能确定管段内的准确漏点。", status: "系统状态", updated: "更新时间", internetLost: "互联网连接已中断 2 分钟。", enterOffline: "打开本地离线仪表板", localOnly: "设备本地视图" },
    learning: ["正在学习正常运行模式", "已收集 {n}/{min} 条基线分析所需读数。"],
    implausible_flow: ["流量超出配置范围", "{max} L/min 超出上限，已拒绝该读数。请检查校准、脉冲接线和电气噪声。"],
    valve_closed_flow: ["阀门状态与流量不一致", "控制器报告阀门关闭，但入口流量约为 {flow} L/min。请检查继电器极性、阀门状态和传感器噪声。"],
    leak_pattern: ["水损失高于学习基线", "估计入口与出口差值为 {loss} L/min（基线 {baseline} L/min）。两个流量传感器之间的管段值得检查。"],
    loss_always_high: ["流量差持续偏高", "水损失为 {loss} L/min，与基线 {baseline} L/min 接近。请先检查传感器校准和管道。"],
    negative_loss: ["出口流量高于入口", "出口流量比入口高约 {excess} L/min。请检查校准、安装位置和流向。"],
    tank_dropping: ["水箱水位下降", "超声波距离每分钟增加约 {slope} cm。请检查水箱及供水管。"],
    level_missing: ["水箱回波经常缺失", "最近至少一半水箱距离读数缺失。请检查供电、接线、安装和回波分压。"],
    sensor_stuck: ["入口传感器可能卡滞", "入口流量连续 90 次读数未变化。请检查传感器和信号线。"],
    offline: ["控制器离线", "当前没有控制器遥测。云端数值已归零，并非当前测量值。"],
    stale_readings: ["遥测数据已过期", "最新读数早于配置的在线时间窗口。"],
    internet_outage: ["互联网连接中断", "控制器已 2 分钟无法连接云端。ESP32 本地漏水保护仍在运行。"],
    internet_restored: ["互联网连接已恢复", "控制器已重新连接配置的云端地址。"],
    device_restored: ["控制器已恢复", "ESP32 控制器正在重新发送遥测数据。"],
    outlet_node_offline: ["出口传感器链路不可用", "ESP32 未收到新的认证出口读数。流量差比较已暂停。"],
    localization: ["入口与出口流量传感器之间的管段", "仅凭两个流量读数无法推断管段内的准确位置。"],
    data_invalid: ["无效遥测已拒绝", "一个或多个读数超出验证范围，未作为有效测量保存。"]
    ,normal: ["当前未发现异常", "已验证读数处于配置范围内；请继续监测。"]
  },
  nl: {
    ui: { insights: "AI-inzichten", health: "Apparaatstatus", language: "Taal", offline: "Offline dashboard", localization: "Waarschijnlijk betrokken leidingdeel", noExactPoint: "De flowmeters identificeren alleen het deel ertussen; een exact lekpunt is niet af te leiden.", status: "Systeemstatus", updated: "Bijgewerkt", internetLost: "Internetverbinding is 2 minuten niet beschikbaar.", enterOffline: "Open lokaal offline dashboard", localOnly: "Lokale apparaatweergave" },
    learning: ["Normaal gedrag leren", "{n} van {min} benodigde metingen voor de basisanalyse verzameld."],
    implausible_flow: ["Debiet buiten ingestelde grens", "Een waarde van {max} L/min overschreed de grens en is afgewezen. Controleer kalibratie, pulsbedrading en ruis."],
    valve_closed_flow: ["Klepstatus past niet bij het debiet", "De controller meldt een gesloten klep terwijl de inlaat ongeveer {flow} L/min meet. Controleer relaispolariteit en sensorruis."],
    leak_pattern: ["Waterverlies boven de basislijn", "Geschat verlies tussen inlaat en uitlaat is {loss} L/min (basislijn {baseline} L/min). Het leidingdeel tussen de twee flowmeters is verdacht."],
    loss_always_high: ["Aanhoudende flowafwijking", "Verlies is {loss} L/min en lijkt op de basislijn ({baseline} L/min). Controleer kalibratie en leidingen."],
    negative_loss: ["Uitlaatdebiet hoger dan inlaat", "Uitlaat ligt ongeveer {excess} L/min boven de inlaat. Controleer kalibratie, plaatsing en stroomrichting."],
    tank_dropping: ["Tankniveau daalt", "De ultrasone afstand neemt ongeveer {slope} cm/min toe. Controleer de tank en toevoer."],
    level_missing: ["Tankecho ontbreekt vaak", "Minstens de helft van de recente tankmetingen ontbreekt. Controleer voeding, bedrading, montage en spanningsdeler."],
    sensor_stuck: ["Inlaatsensor lijkt vast te zitten", "De inlaatflow veranderde niet in 90 metingen. Controleer sensor en signaaldraad."],
    offline: ["Controller offline", "Er is geen actuele telemetrie. Cloudwaarden zijn op nul gezet en zijn geen actuele metingen."],
    stale_readings: ["Telemetrie is verouderd", "De laatste meting valt buiten de ingestelde onlineperiode."],
    internet_outage: ["Internetverbinding weg", "De controller bereikt de cloud al 2 minuten niet. Lokale ESP32-lekbescherming blijft actief."],
    internet_restored: ["Internetverbinding hersteld", "De controller kan de ingestelde cloud weer bereiken."],
    device_restored: ["Controller hersteld", "De ESP32-controller verstuurt weer telemetrie."],
    outlet_node_offline: ["Uitlaatsensorverbinding niet beschikbaar", "De ESP32 heeft geen nieuwe geauthenticeerde uitlaatmeting ontvangen. Flowvergelijking is gepauzeerd."],
    localization: ["Leidingdeel tussen inlaat- en uitlaatflowmeter", "Met twee flowmetingen is geen exact punt af te leiden."],
    data_invalid: ["Ongeldige telemetrie afgewezen", "Een meting overschreed validatiegrenzen en is niet als geldige meting opgeslagen."]
    ,normal: ["Geen actuele afwijking", "Gevalideerde metingen vallen binnen de ingestelde grenzen; blijf monitoren."]
  },
  it: {
    ui: { insights: "Analisi AI", health: "Stato dei dispositivi", language: "Lingua", offline: "Dashboard offline", localization: "Tratto probabilmente interessato", noExactPoint: "I misuratori identificano solo il tratto tra loro; non possono individuare un punto preciso.", status: "Stato del sistema", updated: "Aggiornato", internetLost: "Connessione Internet non disponibile da 2 minuti.", enterOffline: "Apri la dashboard locale offline", localOnly: "Vista locale del dispositivo" },
    learning: ["Apprendimento del comportamento normale", "Raccolte {n} delle {min} letture necessarie per l'analisi di base."],
    implausible_flow: ["Portata fuori dall'intervallo configurato", "Una lettura di {max} L/min ha superato il limite ed è stata rifiutata. Controllare calibrazione, impulsi e rumore."],
    valve_closed_flow: ["Stato valvola incoerente con la portata", "Il controller indica valvola chiusa ma l'ingresso misura circa {flow} L/min. Verificare polarità del relè e rumore del sensore."],
    leak_pattern: ["Perdita d'acqua sopra la base appresa", "Perdita stimata ingresso-uscita: {loss} L/min (base {baseline} L/min). È sospetto il tratto tra i due misuratori."],
    loss_always_high: ["Squilibrio di portata persistente", "La perdita è {loss} L/min, simile alla base ({baseline} L/min). Controllare calibrazione e tubazioni."],
    negative_loss: ["Uscita maggiore dell'ingresso", "L'uscita supera l'ingresso di circa {excess} L/min. Controllare calibrazione, posizione e direzione del flusso."],
    tank_dropping: ["Livello del serbatoio in calo", "La distanza ultrasonica aumenta di circa {slope} cm/min. Controllare serbatoio e alimentazione."],
    level_missing: ["Eco del serbatoio spesso assente", "Almeno metà delle letture recenti manca. Controllare alimentazione, cablaggio, montaggio e partitore."],
    sensor_stuck: ["Sensore di ingresso forse bloccato", "La portata in ingresso non è cambiata in 90 letture. Ispezionare sensore e cavo."],
    offline: ["Controller offline", "Telemetria attuale non disponibile. I valori cloud sono azzerati e non sono misure correnti."],
    stale_readings: ["Telemetria non aggiornata", "L'ultima lettura è più vecchia della finestra online configurata."],
    internet_outage: ["Connessione Internet interrotta", "Il controller non raggiunge il cloud da 2 minuti. La protezione locale ESP32 continua."],
    internet_restored: ["Connessione Internet ripristinata", "Il controller raggiunge di nuovo il cloud configurato."],
    device_restored: ["Controller ripristinato", "ESP32 invia nuovamente la telemetria."],
    outlet_node_offline: ["Collegamento del sensore di uscita non disponibile", "L'ESP32 non ha ricevuto una nuova lettura autenticata. Il confronto dei flussi è sospeso."],
    localization: ["Tratto tra i misuratori di ingresso e uscita", "Due letture di portata non consentono di stimare un punto preciso."],
    data_invalid: ["Telemetria non valida rifiutata", "Una lettura ha superato i limiti di validazione e non è stata salvata come misura valida."]
    ,normal: ["Nessuna anomalia attuale", "Le letture validate rientrano nei limiti configurati; continuare il monitoraggio."]
  },
  es: {
    ui: { insights: "Análisis de IA", health: "Estado de dispositivos", language: "Idioma", offline: "Panel sin conexión", localization: "Tramo probablemente afectado", noExactPoint: "Los caudalímetros solo identifican el tramo entre ellos; no determinan el punto exacto.", status: "Estado del sistema", updated: "Actualizado", internetLost: "La conexión a Internet no está disponible desde hace 2 minutos.", enterOffline: "Abrir panel local sin conexión", localOnly: "Vista local del dispositivo" },
    learning: ["Aprendiendo el comportamiento normal", "Se recopilaron {n} de {min} lecturas necesarias para el análisis de referencia."],
    implausible_flow: ["Caudal fuera del rango configurado", "Una lectura de {max} L/min superó el límite y fue rechazada. Revise la calibración, los pulsos y el ruido."],
    valve_closed_flow: ["Estado de válvula incompatible con el caudal", "El controlador indica válvula cerrada, pero la entrada mide unos {flow} L/min. Revise polaridad del relé y ruido del sensor."],
    leak_pattern: ["Pérdida de agua superior a la referencia", "La pérdida estimada entre entrada y salida es {loss} L/min (referencia {baseline} L/min). El tramo entre ambos caudalímetros es sospechoso."],
    loss_always_high: ["Desequilibrio de caudal persistente", "La pérdida es {loss} L/min, similar a la referencia ({baseline} L/min). Revise calibración y tuberías."],
    negative_loss: ["La salida supera la entrada", "La salida supera la entrada en unos {excess} L/min. Revise calibración, ubicación y sentido del flujo."],
    tank_dropping: ["El nivel del tanque está bajando", "La distancia ultrasónica aumenta unos {slope} cm/min. Revise el tanque y su suministro."],
    level_missing: ["Faltan ecos del tanque con frecuencia", "Falta al menos la mitad de las lecturas recientes. Revise alimentación, cableado, montaje y divisor de tensión."],
    sensor_stuck: ["El sensor de entrada podría estar bloqueado", "El caudal de entrada no cambió en 90 lecturas. Revise el sensor y el cable."],
    offline: ["Controlador sin conexión", "No hay telemetría actual. Los valores de la nube se muestran en cero y no son mediciones actuales."],
    stale_readings: ["Telemetría desactualizada", "La última lectura supera el tiempo configurado para estar en línea."],
    internet_outage: ["Conexión a Internet perdida", "El controlador no llega a la nube desde hace 2 minutos. La protección local ESP32 continúa."],
    internet_restored: ["Conexión a Internet restablecida", "El controlador vuelve a alcanzar la nube configurada."],
    device_restored: ["Controlador restablecido", "El ESP32 vuelve a enviar telemetría."],
    outlet_node_offline: ["Enlace del sensor de salida no disponible", "El ESP32 no recibió una lectura de salida autenticada reciente. Se pausó la comparación de caudales."],
    localization: ["Tramo entre los caudalímetros de entrada y salida", "Dos lecturas de caudal no permiten determinar un punto preciso."],
    data_invalid: ["Telemetría no válida rechazada", "Una lectura excedió los límites de validación y no se guardó como medición válida."]
    ,normal: ["Sin anomalías actuales", "Las lecturas validadas están dentro de los límites configurados; continúe supervisando."]
  },
  hi: {
    ui: { insights: "AI जानकारी", health: "डिवाइस स्वास्थ्य", language: "भाषा", offline: "ऑफ़लाइन डैशबोर्ड", localization: "संभावित प्रभावित पाइप खंड", noExactPoint: "दो फ्लो सेंसर केवल उनके बीच के खंड की पहचान करते हैं; सटीक रिसाव बिंदु नहीं बता सकते।", status: "सिस्टम स्थिति", updated: "अपडेट", internetLost: "इंटरनेट कनेक्शन 2 मिनट से उपलब्ध नहीं है।", enterOffline: "स्थानीय ऑफ़लाइन डैशबोर्ड खोलें", localOnly: "डिवाइस का स्थानीय दृश्य" },
    learning: ["सामान्य व्यवहार सीखा जा रहा है", "आधार विश्लेषण के लिए आवश्यक {min} में से {n} रीडिंग मिलीं।"],
    implausible_flow: ["फ्लो निर्धारित सीमा से बाहर", "{max} L/min की रीडिंग सीमा से अधिक थी और अस्वीकार की गई। कैलिब्रेशन, पल्स वायर और शोर जाँचें।"],
    valve_closed_flow: ["वाल्व स्थिति और फ्लो में विरोध", "कंट्रोलर वाल्व बंद बताता है, जबकि इनलेट लगभग {flow} L/min है। रिले ध्रुवता और सेंसर शोर जाँचें।"],
    leak_pattern: ["पानी की हानि आधार स्तर से अधिक", "इनलेट-आउटलेट अनुमानित हानि {loss} L/min है (आधार {baseline} L/min)। दोनों फ्लो सेंसर के बीच का पाइप खंड संदिग्ध है।"],
    loss_always_high: ["फ्लो अंतर लगातार बना हुआ है", "हानि {loss} L/min है और आधार ({baseline} L/min) जैसी है। नई लीकेज मानने से पहले कैलिब्रेशन और पाइप जाँचें।"],
    negative_loss: ["आउटलेट इनलेट से अधिक", "आउटलेट फ्लो इनलेट से लगभग {excess} L/min अधिक है। कैलिब्रेशन, स्थिति और जल दिशा जाँचें।"],
    tank_dropping: ["टैंक का स्तर घट रहा है", "अल्ट्रासोनिक दूरी लगभग {slope} cm/मिनट बढ़ रही है। टैंक और सप्लाई जाँचें।"],
    level_missing: ["टैंक इको अक्सर नहीं मिलता", "हाल की कम से कम आधी टैंक रीडिंग गायब हैं। बिजली, वायरिंग, माउंटिंग और वोल्टेज डिवाइडर जाँचें।"],
    sensor_stuck: ["इनलेट सेंसर अटका हो सकता है", "90 रीडिंग में इनलेट फ्लो नहीं बदला। सेंसर और सिग्नल तार जाँचें।"],
    offline: ["कंट्रोलर ऑफ़लाइन", "वर्तमान टेलीमेट्री उपलब्ध नहीं है। क्लाउड मान शून्य दिखाए गए हैं और वर्तमान माप नहीं हैं।"],
    stale_readings: ["टेलीमेट्री पुरानी है", "नवीनतम रीडिंग निर्धारित ऑनलाइन समय सीमा से पुरानी है।"],
    internet_outage: ["इंटरनेट कनेक्शन बंद", "कंट्रोलर 2 मिनट से क्लाउड तक नहीं पहुँच पाया। ESP32 की स्थानीय सुरक्षा जारी है।"],
    internet_restored: ["इंटरनेट कनेक्शन बहाल", "कंट्रोलर फिर से निर्धारित क्लाउड तक पहुँच सकता है।"],
    outlet_node_offline: ["आउटलेट सेंसर लिंक उपलब्ध नहीं", "ESP32 को नया प्रमाणित आउटलेट माप नहीं मिला। फ्लो तुलना रोक दी गई है।"],
    localization: ["इनलेट और आउटलेट फ्लो सेंसर के बीच का पाइप खंड", "केवल दो फ्लो माप से सटीक बिंदु ज्ञात नहीं हो सकता।"],
    data_invalid: ["अमान्य टेलीमेट्री अस्वीकार", "एक या अधिक रीडिंग सत्यापन सीमा से बाहर थीं और माप के रूप में संग्रहीत नहीं हुईं।"]
    ,normal: ["अभी कोई असामान्यता नहीं", "सत्यापित रीडिंग निर्धारित सीमाओं में हैं; निगरानी जारी रखें।"]
  }
};

export function normalizeLanguage(code) {
  const candidate = String(code || "en").trim().toLowerCase().split(/[-_]/)[0];
  return messages[candidate] ? candidate : "en";
}

function interpolate(template, params = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? "—" : String(value);
  });
}

export function translate(key, language = "en") {
  const lang = normalizeLanguage(language);
  return messages[lang].ui[key] ?? messages.en.ui[key] ?? key;
}

export function localizeInsight(insight, language = "en") {
  const lang = normalizeLanguage(language);
  const entry = messages[lang][insight?.code] || messages.en[insight?.code];
  if (!entry) return { ...insight };
  const params = insight.params || {};
  return { ...insight, title: entry[0], detail: interpolate(entry[1], params) };
}

const alertKeys = Object.freeze({
  possible_leak: "leak_pattern",
  device_offline: "offline",
  device_restored: "device_restored",
  internet_outage: "internet_outage",
  internet_restored: "internet_restored",
  abnormal_pressure: "data_invalid",
  low_water_level: "tank_dropping"
});

export function translateAlertType(type, language = "en") {
  const lang = normalizeLanguage(language);
  const key = alertKeys[type];
  const entry = key ? messages[lang][key] : null;
  return entry?.[0] || String(type || "alert").replaceAll("_", " ");
}

export function translateAlertMessage(type, originalMessage = "", language = "en") {
  const lang = normalizeLanguage(language);
  const text = String(originalMessage || "");
  const loss = text.match(/([0-9]+(?:\.[0-9]+)?)\s*L\/min/i)?.[1] || "—";
  const code = alertKeys[type];
  if (!code) return text;
  const item = localizeInsight({ code, params: { loss, baseline: "—", max: "30", flow: loss, excess: loss } }, lang);
  return item.detail || item.title || text;
}
