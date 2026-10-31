// El estado error (id «error» en el backend) se muestra con este símbolo en diagramas, tablas y estructuras.
export const ERROR_SYMBOL = 'ξ'
export const showName = (id) => (id === 'error' ? ERROR_SYMBOL : id)