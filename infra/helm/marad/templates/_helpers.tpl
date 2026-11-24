{{- define "marad.name" -}}{{ .root.Release.Name }}-{{ .name }}{{- end -}}

{{- define "marad.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: marad
app.kubernetes.io/version: {{ .root.Values.image.tag | quote }}
helm.sh/chart: {{ .root.Chart.Name }}-{{ .root.Chart.Version }}
{{- end -}}

{{- define "marad.selector" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "marad.image" -}}
{{ .root.Values.image.registry }}/{{ .root.Values.image.prefix }}-{{ .name }}:{{ .root.Values.image.tag }}
{{- end -}}
