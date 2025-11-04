window.TreeView = window.TreeView || (() => {
    console.log('🟢 Definiendo TreeView global');

    let chart;

    async function init(containerId = 'tree-chart', jsonPath = 'data/class-hierarchy2.json') {
        const el = document.getElementById(containerId);
        chart = echarts.init(el, null, { renderer: 'canvas' });

        // === Botón dentro del contenedor ===
        let resetBtn = document.getElementById('reset-tree-btn');
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.id = 'reset-tree-btn';
            resetBtn.textContent = 'Reiniciar vista';
            resetBtn.classList.add('reset-tree-btn');
            el.appendChild(resetBtn);
            resetBtn.addEventListener('click', () => chart.dispatchAction({ type: 'restore' }));
        }

        chart.showLoading();
        console.log('TreeView.init ejecutado');

        try {
            const res = await fetch(jsonPath);
            let data = await res.json();
            chart.hideLoading();

            // Envolver múltiples raíces en una raíz virtual oculta
            if (Array.isArray(data)) {
                data = { name: 'Ontology', invisibleRoot: true, children: data };
            }

            // Colapsar algunas ramas iniciales
            if (data.children) {
                data.children.forEach((child, index) => {
                    if (index % 2 === 0) child.collapsed = true;
                });
            }


            // 1) Cargar ontology2.json y construir índice por name/label/id (sin 'CAT_')
            let metaByKey = new Map();
            try {
            const ontoRes = await fetch('data/ontology2.json');
            const ontology = await ontoRes.json();

            // Normalizador para claves
            const k = v => (v ? String(v).trim().toLowerCase() : '');

            (ontology.nodes || []).forEach(n => {
                const name = k(n.name);
                const label = k(n.label);
                const id = k(String(n.id || '').replace(/^CAT_/i, '')); // id sin prefijo

                const meta = { source: n.source || '', info: n.info || '' };

                if (name) metaByKey.set(name, meta);
                if (label) metaByKey.set(label, meta);
                if (id) metaByKey.set(id, meta);
            });

            // 2) Enriquecer el árbol con source/info buscándolo por name y por variantes
            function enrich(node) {
                if (!node) return;

                const nameKey = k(node.name);
                // intenta por nombre directo, por última parte (por si viene algo jerárquico), y por id-like
                const shortKey = nameKey.includes('.') ? nameKey.split('.').pop() : nameKey;

                const meta =
                metaByKey.get(nameKey) ||
                metaByKey.get(shortKey);

                if (meta) {
                // solo sobreescribe si no existe ya en el nodo
                if (!node.source && meta.source) node.source = meta.source;
                if (!node.info && meta.info) node.info = meta.info;
                }

                (node.children || []).forEach(enrich);
            }

            enrich(data);

            console.log('[TreeView] Metadatos añadidos desde ontology2.json');
            } catch (e) {
            console.warn('[TreeView] No se pudo cargar/mezclar ontology2.json:', e);
            }

            // === 🎨 Colorea cada línea según el color del nodo padre ===
            function colorForOrigin(n) {
                const src = (n?.source || n?.info || n?.data?.source || n?.data?.info || '').toLowerCase();
                if (src.includes('mim')) 
                    return '#00e68a';           // Verde MIM
                if (src.includes('cyberdem') || src.includes('cdem')) 
                    return '#00baff'; // Azul CDEM
                return '#ff9f1c';                                   // Naranja propio
            }

            function applyLineColors(node) {
                if (!node) return;

                // Calcula el color en base al origen (source/info)
                //const nodeColor = inheritedColor || colorForOrigin(node);
                const color = colorForOrigin(node);

                // Aplica color tanto a la línea como al punto (símbolo)
                node.lineStyle = node.lineStyle || {};
                node.lineStyle.color = color;

                node.itemStyle = node.itemStyle || {};
                node.itemStyle.color = color; // 👈 color del punto

                // Si quieres también borde o halo:
                node.itemStyle.borderColor = color;
                node.itemStyle.borderWidth = 1.5;

                // Recursivo para hijos
                if (node.children && node.children.length) {
                    node.children.forEach(child => applyLineColors(child));
                }
            }

            applyLineColors(data);

            const option = {
                backgroundColor: '#0c0c0c',
                tooltip: {
                    trigger: 'item',
                    triggerOn: 'mousemove',
                    backgroundColor: '#1e1e1e',
                    borderColor: '#333',
                    textStyle: { color: '#fff', fontSize: 10 },
                    formatter: info => `<b>${info.name}</b>`
                },
                series: [
                    {
                        type: 'tree',
                        data: [data],
                        top: '5%',
                        left: '10%',
                        bottom: '5%',
                        right: '20%',
                        symbol: 'circle',
                        roam: true,
                        scaleLimit: { min: 0.5, max: 3 },
                        zoom: 1.1,

                        // 🌈 Coloreado dinámico
                        lineStyle: {
                            color: params => {
                                // 🔹 Usar directamente el color ya calculado en applyLineColors()
                                return params.data?.lineStyle?.color || '#ff9f1c';
                            },
                            width: 1.6,
                            opacity: 0.75,
                            shadowBlur: 6,
                            shadowColor: '#000'
                        },
                        symbolSize: (value, params) => Math.max(6, 12 - (params.treeDepth || 0)),

                        itemStyle: {
                            color: params => {
                                if (!params || !params.data) return '#888';
                                if (params.data.invisibleRoot) return 'transparent';
                                const d = params.treeDepth || 0;
                                const hasChildren = params.data.children?.length > 0;

                                if (hasChildren) {
                                    if (d === 1) return '#00ffff';
                                    if (d === 2) return '#4cc9f0';
                                    if (d === 3) return '#3a86ff';
                                    return '#7aa2ff';
                                }
                                return '#88aaff';
                            },
                            borderColor: '#0ff',
                            borderWidth: 0.5
                        },

                        label: {
                            position: 'left',
                            verticalAlign: 'middle',
                            align: 'right',
                            color: '#eee',
                            fontFamily: 'Orbitron',
                            fontSize: 12,
                            formatter: params =>
                                params?.data?.invisibleRoot ? '' : (params?.data?.name ?? '')
                        },

                        leaves: {
                            label: {
                                position: 'right',
                                verticalAlign: 'middle',
                                align: 'left',
                                color: '#ccc'
                            }
                        },

                        emphasis: {
                            focus: 'none',
                            itemStyle: {
                                shadowBlur: 12,
                                shadowColor: '#00ffff',
                                borderColor: '#00ffff',
                                borderWidth: 1.5
                            },
                            label: { color: '#00ffff', fontWeight: 'bold' }
                        },

                        expandAndCollapse: true,
                        initialTreeDepth: 1,
                        animationDuration: 550,
                        animationDurationUpdate: 750
                    }
                ]
            };

            console.log('📊 Datos del árbol cargados:', data);



            console.table(data.children.map(n => ({
                name: n.name,
                color: n.lineStyle?.color || '(none)',
                source: n.source || n.info || ''
            })));


            chart.setOption(option);

            // 🧮 Forzar el cálculo completo del layout de todos los nodos visibles
            setTimeout(() => {
                chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: 0 });
                chart.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: 0 });
                chart.resize();
                console.log('🧩 Layout forzado calculado para todos los nodos');
            }, 500);


            // 🔧 Asegura que el canvas no limite el renderizado de líneas externas
            const canvas = el.querySelector('canvas');
            if (canvas) {
                canvas.style.overflow = 'visible';
                canvas.style.position = 'relative';
            }

            // === 🧭 Interacción: highlight hacia los padres ===
            let parentMap = {};   // hijo → padre
            let lastHighlighted = [];

            // 🔹 Construye el mapa de padres (ejecutar tras cargar el JSON)
            function buildParentMap(node, parent = null) {
                if (!node) return;
                if (node.name) parentMap[node.name] = parent ? parent.name : null;
                (node.children || []).forEach(child => buildParentMap(child, node));
            }
            // Llamar a buildParentMap(data) justo después de cargar los datos del árbol


            // 🔹 Hover sobre un nodo → resalta toda su cadena de padres
            chart.on('mouseover', params => {
                if (!params?.data || params.data.invisibleRoot) return;

                const series = chart.getModel().getSeriesByIndex(0);
                const tree = series.getData().tree;
                const node = tree.getNodeByDataIndex(params.dataIndex);

                // ✅ Esperar a que ECharts termine completamente el render
                const drawOnce = () => {
                    // ⚙️ Forzar un pequeño retraso para asegurar que layout esté disponible
                    requestAnimationFrame(() => {
                        drawParentLines(tree, series.getData(), node);
                    });
                    chart.off('finished', drawOnce); // desconectamos tras ejecutarse
                };

                // 🔸 Si el gráfico ya está listo, no esperamos el evento
                if (chart.isDisposed()) return;
                if (chart._chartsViews?.length) {
                    // Si ya hay datos renderizados, dibuja directamente con 1 frame de retardo
                    requestAnimationFrame(() => drawParentLines(tree, series.getData(), node));
                } else {
                    // Si todavía está renderizando, espera al evento
                    chart.on('finished', drawOnce);
                }
            });




            // 🔹 Al salir del nodo → limpia los resaltados
            chart.on('mouseout', () => {
                lastHighlighted.forEach(name =>
                    chart.dispatchAction({ type: 'downplay', name })
                );
                lastHighlighted = [];
                clearOverlay();   // 🩵 Limpia las líneas al salir
            });

            buildParentMap(data);

            // === ✳️ Overlay de líneas ascendentes (añadir tras buildParentMap y chart.setOption) ===
            const zr = chart.getZr();
            let overlayGroups = [];

            // 🔹 Limpia líneas y puntos previos
            function clearOverlay() {
                overlayGroups.forEach(g => zr.remove(g));
                overlayGroups = [];
            }


            // 🔹 Dibuja una línea coloreada según el origen del nodo
            function drawConnectionLine(p1, p2, node) {
                const color = colorForOrigin(node);

                const line = new echarts.graphic.Line({
                    shape: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
                    style: {
                        stroke: color,
                        lineWidth: 1.8,
                        opacity: 0.45,
                        shadowBlur: 8,
                        shadowColor: color
                    },
                    z: 1000
                });

                zr.add(line);
                overlayGroups.push(line);
            }


            // 🔹 Dibuja un punto brillante
            function drawGlowPoint(p) {
                const dot = new echarts.graphic.Circle({
                    shape: { cx: p.x, cy: p.y, r: 3.5 },
                    style: {
                        fill: '#00ffff',
                        opacity: 0.6,
                        shadowBlur: 10,
                        shadowColor: '#00ffff'
                    },
                    z: 1001
                });
                zr.add(dot);
                overlayGroups.push(dot);
            }

            // === 🩵 Función auxiliar para dibujar desde un nodo hacia sus padres (con color del padre) ===
            function drawParentLines(tree, data, node) {
                if (!tree || !data || !node) {
                    console.warn('[TreeView] drawParentLines: parámetros inválidos', { tree: !!tree, data: !!data, node });
                    return;
                }

                console.group('[TreeView] drawParentLines');
                console.log('Nodo inicial:', {
                    name: node?.data?.name || node?.name,
                    id: node?.data?.id || node?.id,
                    source: node?.data?.source || node?.data?.info || node?.source || node?.info || '(sin source)'
                });

                clearOverlay();

                // === Función para obtener color según origen ===
                function colorForOrigin(n) {
                    const src = (n?.data?.source || n?.data?.info || n?.source || n?.info || '').toLowerCase();
                    if (src.includes('mim')) 
                        return '#00e68a';
                    if (src.includes('cyberdem') || src.includes('cdem')) 
                        return '#00baff';
                    return '#ff9f1c';
                }

                // === Calcula posición (x, y) del nodo en píxeles ===
                function getNodePos(n) {
                    if (!n) return null;
                    try {
                        const layout = n.getLayout?.();
                        if (!layout || !Array.isArray(layout)) {
                            console.warn('⚠️ getNodePos: layout no disponible aún para', n.data?.name);
                            return null;
                        }

                        const pixel = chart.convertToPixel({ seriesIndex: 0 }, layout);
                        if (!pixel || pixel.length < 2 || isNaN(pixel[0]) || isNaN(pixel[1])) {
                            console.warn('⚠️ getNodePos: convertToPixel devolvió valor inválido', pixel, 'para', n.data?.name);
                            return null;
                        }

                        return { x: pixel[0], y: pixel[1] };
                    } catch (err) {
                        console.error('❌ getNodePos error en', n.data?.name, err);
                        return null;
                    }
                }


                // === Recorre hacia arriba y dibuja líneas ===
                let current = node;
                let count = 0;

                while (current && current.parentNode) {
                    const parent = current.parentNode;
                    const p1 = getNodePos(current);
                    const p2 = getNodePos(parent);
                    if (!p1 || !p2) break;

                    const parentColor = colorForOrigin(parent);
                    const line = new echarts.graphic.Line({
                        shape: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
                        style: {
                            stroke: parentColor,
                            lineWidth: 2,
                            opacity: 0.65,
                            shadowBlur: 10,
                            shadowColor: parentColor
                        },
                        z: 1000
                    });

                    const dot = new echarts.graphic.Circle({
                        shape: { cx: p1.x, cy: p1.y, r: 3 },
                        style: {
                            fill: parentColor,
                            opacity: 0.8,
                            shadowBlur: 8,
                            shadowColor: parentColor
                        },
                        z: 1001
                    });

                    chart.getZr().add(line);
                    chart.getZr().add(dot);
                    overlayGroups.push(line, dot);
                    count++;

                    current = parent;
                }

                console.log(`total segmentos dibujados: ${count} overlayGroups: ${overlayGroups.length}`);
                console.groupEnd();
            }




            // === Click en nodos ===
            chart.on('click', params => {
                const baseName = params?.data?.id ?? params?.data?.name;
                if (!baseName || params?.data?.invisibleRoot) return;

                const nodeId = baseName.startsWith('CAT_') ? baseName : 'CAT_' + baseName;

                console.log(`🟠 Nodo seleccionado: ${nodeId}`);
                window.dispatchEvent(new CustomEvent('node:select', { detail: { id: nodeId } }));
            });

            // === Redibujo responsivo ===
            window.addEventListener('resize', () => chart.resize());

            // === Integración con Dropdown ===
            window.addEventListener('dropdown:change', async e => {
                const root = e.detail?.root;
                if (!root || !chart) return;

                console.log(`[TreeView] Filtro raíz cambiado a: ${root}`);

                try {
                    // 1) Cargar el árbol completo
                    const res = await fetch('data/class-hierarchy2.json');
                    const fullData = await res.json();

                    // 2) Buscar la rama seleccionada
                    function findNodeByName(node, name) {
                    if (!node) return null;
                    if (node.name === name) return node;
                    const children = node.children || [];
                    for (const child of children) {
                        const r = findNodeByName(child, name);
                        if (r) return r;
                    }
                    return null;
                    }

                    let branch = null;
                    if (Array.isArray(fullData)) {
                    for (const n of fullData) { branch = findNodeByName(n, root); if (branch) break; }
                    } else {
                    branch = findNodeByName(fullData, root);
                    }
                    if (!branch) {
                    console.warn(`[TreeView] No se encontró el nodo "${root}" en ninguna rama`);
                    return;
                    }

                    // 3) Clonar la rama para no mutar el dataset original
                    const clone = JSON.parse(JSON.stringify(branch));

                    // 4) Cargar ontology2.json y construir índice para enriquecer la rama
                    let metaByKey = new Map();
                    const k = v => (v ? String(v).trim().toLowerCase() : '');

                    try {
                    const ontoRes = await fetch('data/ontology2.json');
                    const ontology = await ontoRes.json();

                    (ontology.nodes || []).forEach(n => {
                        const name = k(n.name);
                        const label = k(n.label);
                        const id = k(String(n.id || '').replace(/^CAT_/i, ''));
                        const meta = { source: n.source || '', info: n.info || '' };
                        if (name) metaByKey.set(name, meta);
                        if (label) metaByKey.set(label, meta);
                        if (id) metaByKey.set(id, meta);
                    });
                    } catch (err) {
                    console.warn('[TreeView] No se pudo cargar ontology2.json para enriquecer la rama:', err);
                    }

                    function enrich(node) {
                    if (!node) return;
                    const nameKey = k(node.name);
                    const shortKey = nameKey.includes('.') ? nameKey.split('.').pop() : nameKey;
                    const meta = metaByKey.get(nameKey) || metaByKey.get(shortKey);
                    if (meta) {
                        if (!node.source && meta.source) node.source = meta.source;
                        if (!node.info && meta.info) node.info = meta.info;
                    }
                    (node.children || []).forEach(enrich);
                    }
                    enrich(clone); // ✅ ya trae source/info

                    // 5) Recalcular colores para líneas y puntos
                    applyLineColors(clone);

                    // 6) Pintar sólo esa rama
                    chart.setOption({
                    series: [{ data: [clone] }]
                    });

                    const nodeId = clone.id || (clone.name.startsWith('CAT_') ? clone.name : 'CAT_' + clone.name);
                    console.log(`🟣 Nodo activado desde Dropdown: ${nodeId}`);
                    window.dispatchEvent(new CustomEvent('node:select', { detail: { id: nodeId } }));
                } catch (err) {
                    console.error('[TreeView] Error al cambiar raíz desde Dropdown:', err);
                }
            });

        } catch (err) {
            console.error('❌ No se pudo cargar el árbol:', err);
            chart.hideLoading();
        }
    }

    return { init };
})();
