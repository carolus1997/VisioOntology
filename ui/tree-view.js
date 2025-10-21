window.TreeView = window.TreeView || (() => {
    console.log('🟢 Definiendo TreeView global');

    let chart;

    async function init(containerId = 'tree-chart', jsonPath = 'data/class-hierarchy2.json'){
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

                        lineStyle: {
                            color: '#555',
                            width: 1.2
                        },

                        // Tamaño por nivel
                        symbolSize: (value, params) => Math.max(6, 12 - (params.treeDepth || 0)),

                        // Colores
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
                            focus: 'none', // 🚫 desactiva el enfoque descendente
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

            chart.setOption(option);


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
                const series = chart.getModel().getSeriesByIndex(0);
                const tree = series.getData().tree;
                const node = tree.getNodeByDataIndex(params.dataIndex);
                drawParentLines(tree, series.getData(), node);   // 🩵 Dibuja líneas y puntos

                if (!params?.data || params.data.invisibleRoot) return;

                // Limpia los anteriores
                lastHighlighted.forEach(name =>
                    chart.dispatchAction({ type: 'downplay', name })
                );
                lastHighlighted = [];

                // Recorre el árbol lógico hacia arriba (sin tocar el layout)
                let current = params.data.name;
                while (current) {
                    chart.dispatchAction({ type: 'highlight', name: current });
                    lastHighlighted.push(current);
                    current = parentMap[current];
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

            // 🔹 Dibuja una línea tenue entre dos puntos
            function drawConnectionLine(p1, p2) {
                const line = new echarts.graphic.Line({
                    shape: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
                    style: {
                        stroke: '#00ffff',
                        lineWidth: 1.2,
                        opacity: 0.35,
                        shadowBlur: 6,
                        shadowColor: '#00ffff'
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

            // === 🩵 Función auxiliar para dibujar desde un nodo hacia sus padres ===
            function drawParentLines(tree, data, node) {
                if (!tree || !data || !node) return;
                clearOverlay();

                const zr = chart.getZr();

                try {
                    // 🔸 Función auxiliar para obtener coordenadas globales seguras
                    function getNodePosition(n) {
                        if (!n) return null;
                        const el = data.getItemGraphicEl(n.dataIndex);
                        if (el) {
                            // Buscar el círculo dentro del grupo
                            let circle = null;
                            el.traverse(child => {
                                if (child.type === 'circle') circle = child;
                            });
                            if (circle && circle.shape) {
                                // Usar su transformación completa (funciona en canvas)
                                const m = circle.transform || [1, 0, 0, 1, 0, 0];
                                const x = m[0] * circle.shape.cx + m[2] * circle.shape.cy + m[4];
                                const y = m[1] * circle.shape.cx + m[3] * circle.shape.cy + m[5];
                                return { x, y };
                            }
                        }

                        // 🔹 Si no hay elemento renderizado, usar fallback de layout
                        const layout = n.getLayout?.();
                        if (layout) {
                            const pixel = chart.convertToPixel({ seriesIndex: 0 }, layout);
                            if (pixel) return { x: pixel[0], y: pixel[1] };
                        }

                        return null;
                    }

                    let current = node;
                    while (current && current.parent) {
                        const pos = getNodePosition(current);
                        const parentPos = getNodePosition(current.parent);
                        if (pos && parentPos) {
                            drawConnectionLine(pos, parentPos);
                            drawGlowPoint(parentPos);
                        }
                        current = current.parent;
                    }
                } catch (err) {
                    console.warn('⚠️ Error al trazar líneas ascendentes:', err);
                }

                zr.refresh(); // 🔸 Forzar render inmediato
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
                    const res = await fetch('data/class-hierarchy2.json');
                    const fullData = await res.json();

                    function findNodeByName(node, name) {
                        if (!node) return null;
                        if (node.name === name) return node;

                        const children = node.children || [];
                        for (const child of children) {
                            const result = findNodeByName(child, name);
                            if (result) return result;
                        }
                        return null;
                    }

                    let branch = null;
                    if (Array.isArray(fullData)) {
                        for (const n of fullData) {
                            branch = findNodeByName(n, root);
                            if (branch) break;
                        }
                    } else {
                        branch = findNodeByName(fullData, root);
                    }

                    if (branch) {
                        chart.setOption({
                            series: [{ data: [{ ...branch }] }]
                        });

                        const nodeId =
                            branch.id ||
                            (branch.name.startsWith('CAT_')
                                ? branch.name
                                : 'CAT_' + branch.name);
                        console.log(`🟣 Nodo activado desde Dropdown: ${nodeId}`);
                        window.dispatchEvent(
                            new CustomEvent('node:select', { detail: { id: nodeId } })
                        );
                    } else {
                        console.warn(
                            `[TreeView] No se encontró el nodo "${root}" en ninguna rama`
                        );
                    }
                } catch (err) {
                    console.error(
                        '[TreeView] Error al cambiar raíz desde Dropdown:',
                        err
                    );
                }
            });
        } catch (err) {
            console.error('❌ No se pudo cargar el árbol:', err);
            chart.hideLoading();
        }
    }

    return { init };
})();
