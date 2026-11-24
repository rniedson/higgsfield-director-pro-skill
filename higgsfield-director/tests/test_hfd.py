"""Testes do hfd.py. Rodar da raiz da skill:  python3 -m unittest discover -s tests -v

Cada teste marcado "RC3" reproduz um defeito medido na versão do ChatGPT (docs/AVALIACAO-RC3.md).
"""
import copy
import csv
import io
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))
import hfd  # noqa: E402

CATALOGO = {
    "gerado_em": "2099-01-01",
    "modelos": {
        "cs4": hfd._normalizar_modelo({
            "id": "cs4", "name": "Cinema Studio 4.0", "output_type": "video",
            "aspect_ratios": ["auto", "16:9", "9:16"],
            "parameters": [
                {"name": "mode", "options": ["t2v", "omni_reference", "video_edit", "video_extension"]},
                {"name": "duration", "min": 4, "max": 30, "default": 5},
                {"name": "resolution", "options": ["480p", "720p", "1080p"]},
                {"name": "generate_audio", "type": "bool", "default": True}],
            "medias": [{"roles": ["start_image", "end_image", "image_references"]}]}),
        "veo": hfd._normalizar_modelo({
            "id": "veo", "name": "Veo", "output_type": "video", "aspect_ratios": ["16:9", "9:16"],
            "parameters": [{"name": "duration", "options": [4, 6, 8]}], "tags": ["audio"],
            "medias": [{"roles": ["start_image"]}]}),
        "mudo": hfd._normalizar_modelo({
            "id": "mudo", "name": "Sem som", "output_type": "video", "aspect_ratios": [],
            "parameters": [{"name": "duration", "min": 3, "max": 10}],
            "medias": [{"roles": ["video_references"]}]}),
        "kling": hfd._normalizar_modelo({
            "id": "kling", "name": "Kling", "output_type": "video", "aspect_ratios": ["16:9", "9:16", "1:1"],
            "parameters": [{"name": "duration", "min": 3, "max": 15},
                           {"name": "sound", "options": ["on", "off"], "default": "on"}],
            "medias": [{"roles": ["start_image", "end_image"]}]}),
        "foto": hfd._normalizar_modelo({
            "id": "foto", "name": "Imagem", "output_type": "image", "aspect_ratios": ["1:1"],
            "parameters": [], "medias": []}),
    },
}


def projeto(**kw):
    p = {"modelo": "cs4", "modo": "t2v", "proporcao": "9:16",
         "tomadas": [{"id": "T01", "duracao": 5, "sujeito": "A glass bottle", "acao": "It rests on a plinth",
                      "camera": "slow orbit"}]}
    p.update(kw)
    return p


def tomada(p, **kw):
    p["tomadas"][0].update(kw)
    return p


class Camera(unittest.TestCase):
    def avisos(self, txt):
        return hfd.avaliar_camera(txt)[0]

    def test_rc3_negacao_nao_e_conflito(self):
        for txt in ("static camera, no orbit", "locked-off shot, no pan or dolly",
                    "Locked-off shot without any zoom", "fixed camera, never pans"):
            self.assertEqual(self.avisos(txt), [], txt)

    def test_rc3_sujeito_estatico_nao_e_camera_estatica(self):
        self.assertEqual(self.avisos("slow orbit around a static subject"), [])

    def test_fases_sao_permitidas(self):
        self.assertEqual(self.avisos("static camera, then a slow dolly in"), [])
        self.assertEqual(self.avisos("Locked-off for two seconds; then slow push-in"), [])

    def test_conflito_real_vira_aviso(self):
        a = self.avisos("static camera with a slow orbit")
        self.assertTrue(a and "parada e em movimento" in a[0])

    def test_dois_movimentos_simultaneos(self):
        a = self.avisos("dolly in while panning left")
        self.assertTrue(any("mais de um movimento" in x for x in a))

    def test_rc3_camera_nunca_bloqueia_a_compilacao(self):
        p = tomada(projeto(), camera="static camera with a slow orbit")
        r = hfd.compilar(p, CATALOGO)
        self.assertEqual(r["erros"], [])
        self.assertTrue(r["avisos"])


class ModeloEAudio(unittest.TestCase):
    def test_rc3_audio_do_cinema_studio_fica_no_prompt(self):
        p = tomada(projeto(), som="soft glass chime")
        r = hfd.compilar(p, CATALOGO)
        t = r["tomadas"][0]
        self.assertIn("Audio: Soft glass chime.", t["prompt"])
        self.assertIs(t["parametros"]["generate_audio"], True)
        self.assertFalse(any("pós-produção" in a for a in r["avisos"]))

    def test_kling_usa_on_off(self):
        t = hfd.compilar(tomada(projeto(modelo="kling"), som="rain"), CATALOGO)["tomadas"][0]
        self.assertEqual(t["parametros"]["sound"], "on")
        t = hfd.compilar(projeto(modelo="kling"), CATALOGO)["tomadas"][0]
        self.assertEqual(t["parametros"]["sound"], "off")

    def test_modelo_sem_audio_avisa(self):
        r = hfd.validar(tomada(projeto(modelo="mudo"), som="rain"), CATALOGO)
        self.assertTrue(any("pós-produção" in a for a in r["avisos"]))

    def test_rc3_modelo_desconhecido_avisa(self):
        r = hfd.validar(projeto(modelo="kling-3.0"), CATALOGO)
        self.assertTrue(any("não está no retrato" in a for a in r["avisos"]))

    def test_duracao_fora_do_modelo(self):
        self.assertTrue(hfd.validar(tomada(projeto(), duracao=31), CATALOGO)["erros"])
        self.assertTrue(hfd.validar(tomada(projeto(modelo="veo", proporcao="16:9"), duracao=5), CATALOGO)["erros"])
        self.assertEqual(hfd.validar(tomada(projeto(modelo="veo", proporcao="16:9"), duracao=6), CATALOGO)["erros"], [])

    def test_proporcao_e_resolucao(self):
        self.assertTrue(hfd.validar(projeto(proporcao="4:3"), CATALOGO)["erros"])
        self.assertTrue(hfd.validar(projeto(resolucao="4k"), CATALOGO)["erros"])

    def test_i2v_escolhe_modo_omni_reference(self):
        p = projeto(modo="i2v", referencias=["start_image"], preservar=["face"])
        t = hfd.compilar(p, CATALOGO)["tomadas"][0]
        self.assertEqual(t["parametros"]["mode"], "omni_reference")
        self.assertTrue(t["prompt"].startswith("The reference image is the opening frame; preserve face."))
        self.assertNotIn("A glass bottle", t["prompt"])  # em i2v a imagem já traz o sujeito

    def test_i2v_sem_imagem_inicial(self):
        p = projeto(modelo="mudo", modo="i2v", proporcao=None)
        self.assertTrue(any("imagem inicial" in e for e in hfd.validar(p, CATALOGO)["erros"]))

    def test_modo_e_tipo_do_modelo(self):
        self.assertTrue(hfd.validar(projeto(modelo="foto", proporcao="1:1"), CATALOGO)["erros"])

    def test_imagem_ignora_tempo_e_som(self):
        p = projeto(modelo="foto", modo="imagem", proporcao="1:1")
        tomada(p, som="rain", camera="dolly in")
        r = hfd.compilar(p, CATALOGO)
        self.assertEqual(r["erros"], [])
        self.assertNotIn("Audio", r["tomadas"][0]["prompt"])
        self.assertNotIn("orbit", r["tomadas"][0]["prompt"].lower())


class Continuidade(unittest.TestCase):
    def base(self):
        p = projeto(biblias={"P01": {"descricao": "A black bottle with a gold cap", "fixo": {"cor": "black"}}})
        t1 = {"id": "T01", "duracao": 5, "entidades": ["P01"], "acao": "rests", "inicio": {"P01": {"lugar": "mesa"}}}
        t2 = {"id": "T02", "duracao": 5, "entidades": ["P01"], "acao": "rests", "inicio": {"P01": {"lugar": "chão"}}}
        p["tomadas"] = [t1, t2]
        return p

    def test_rc3_tomada_sem_fim_ainda_confere_a_fronteira(self):
        r = hfd.validar(self.base(), CATALOGO)
        self.assertTrue(any("T02: P01.lugar começa" in e for e in r["erros"]), r)
        self.assertTrue(any("T01: sem 'fim'" in a for a in r["avisos"]))

    def test_mudanca_aprovada(self):
        p = self.base()
        p["tomadas"][1]["mudancas_aprovadas"] = ["P01.lugar"]
        self.assertEqual(hfd.validar(p, CATALOGO)["erros"], [])

    def test_atributo_fixo(self):
        p = self.base()
        p["tomadas"][0]["fim"] = {"P01": {"cor": "red", "lugar": "mesa"}}
        self.assertTrue(any("ficha fixa" in e for e in hfd.validar(p, CATALOGO)["erros"]))

    def test_entidade_sem_ficha(self):
        p = self.base()
        p["tomadas"][0]["entidades"] = ["X9"]
        self.assertTrue(any("X9" in e for e in hfd.validar(p, CATALOGO)["erros"]))

    def test_descricao_da_ficha_repete_em_toda_tomada(self):
        p = self.base()
        p["tomadas"][1]["mudancas_aprovadas"] = ["P01.lugar"]
        r = hfd.compilar(p, CATALOGO)
        for t in r["tomadas"]:
            self.assertTrue(t["prompt"].startswith("A black bottle with a gold cap."))

    def test_eixo_180(self):
        p = self.base()
        p["tomadas"][1]["mudancas_aprovadas"] = ["P01.lugar"]
        p["eixo"] = [[0, 0], [4, 0]]
        p["tomadas"][0]["camera_xy"] = [1, -2]
        p["tomadas"][1]["camera_xy"] = [1, 2]
        self.assertTrue(any("180" in a for a in hfd.validar(p, CATALOGO)["avisos"]))
        p["tomadas"][1]["cruzamento_motivado"] = True
        self.assertFalse(any("180" in a for a in hfd.validar(p, CATALOGO)["avisos"]))


class Regras(unittest.TestCase):
    def test_fala_longa_demais(self):
        p = tomada(projeto(), falas=[{"quem": "A", "texto": " ".join(["palavra"] * 20)}])
        self.assertTrue(any("não cabem" in a for a in hfd.validar(p, CATALOGO)["avisos"]))

    def test_fala_sem_rotulo(self):
        p = tomada(projeto(), falas=[{"texto": "Oi"}])
        self.assertTrue(hfd.validar(p, CATALOGO)["erros"])

    def test_fala_rotulada_no_prompt(self):
        p = tomada(projeto(), falas=[{"quem": "Ana", "idioma": "Brazilian Portuguese", "texto": "Bom dia."}])
        self.assertIn('Ana says in Brazilian Portuguese: "Bom dia."', hfd.compilar(p, CATALOGO)["tomadas"][0]["prompt"])

    def test_linha_do_tempo_sobreposta(self):
        p = tomada(projeto(), linha_do_tempo=[{"trilha": "camera", "de": 0, "ate": 3},
                                               {"trilha": "camera", "de": 2, "ate": 5}])
        self.assertTrue(any("sobrepostos" in e for e in hfd.validar(p, CATALOGO)["erros"]))

    def test_rc3_campos_vazios_nao_geram_linha_vazia(self):
        prompt = hfd.compilar(projeto(), CATALOGO)["tomadas"][0]["prompt"]
        self.assertNotIn("LOCKS", prompt)
        self.assertNotIn("..", prompt)
        self.assertNotIn("  ", prompt)

    def test_rc3_frases_inteiras(self):
        prompt = hfd.compilar(projeto(), CATALOGO)["tomadas"][0]["prompt"]
        self.assertIn("Slow orbit.", prompt)

    def test_sem_tomadas(self):
        self.assertTrue(hfd.validar({"modelo": "cs4"}, CATALOGO)["erros"])


class Contas(unittest.TestCase):
    def test_orcamento(self):
        r = hfd.orcamento([{"id": "T01", "custo_teste": 10, "custo_final": 35}], reserva=20)
        self.assertEqual(r["base"], 55)
        self.assertEqual(r["total"], 66)

    def test_orcamento_sem_preco_recusa(self):
        with self.assertRaises(hfd.Erro):
            hfd.orcamento([{"id": "T01"}])

    def test_otica_formula_exata(self):
        r = hfd.otica(50, 4, 2.8)
        self.assertAlmostEqual(r["campo_de_visao_horizontal_graus"], 39.6, places=1)
        self.assertAlmostEqual(r["foco_de_m"], 3.531, places=3)
        self.assertAlmostEqual(r["foco_ate_m"], 4.612, places=3)
        with self.assertRaises(hfd.Erro):
            hfd.otica(50, 0.01)

    def test_pontuar_exige_evidencia(self):
        x = json.loads((RAIZ / "templates/avaliacao.json").read_text())
        self.assertEqual(hfd.pontuar(x)["situacao"], "aprovado com ajustes")
        y = copy.deepcopy(x)
        y["criterios"]["camera"]["evidencia"] = ""
        with self.assertRaises(hfd.Erro):
            hfd.pontuar(y)
        y = copy.deepcopy(x)
        y["falha_critica"] = True
        self.assertTrue(hfd.pontuar(y)["situacao"].startswith("bloqueado"))
        y = copy.deepcopy(x)
        del y["arquivo"]
        with self.assertRaises(hfd.Erro):
            hfd.pontuar(y)


class Arquivos(unittest.TestCase):
    def test_exportar(self):
        p = tomada(projeto(), sujeito="=HYPERLINK(1)", falas=[{"quem": "A", "texto": "Oi."}])
        with tempfile.TemporaryDirectory() as d:
            r = hfd.exportar(p, d, CATALOGO)
            self.assertEqual(sorted(r["arquivos"]), ["legendas.srt", "roteiro.md", "tomadas.csv"])
            with open(Path(d) / "tomadas.csv", encoding="utf-8") as fh:
                linhas = list(csv.reader(fh))
            self.assertFalse(linhas[1][4].startswith("="))
            self.assertIn("00:00:00,000 --> 00:00:05,000", (Path(d) / "legendas.srt").read_text())

    def test_modelos_importar_normaliza(self):
        bruto = {"items": [{"id": "x1", "name": "X", "output_type": "video", "aspect_ratios": ["16:9"],
                            "parameters": [{"name": "duration", "options": [5, 10]},
                                           {"name": "sound", "options": ["on", "off"]}],
                            "medias": [{"roles": ["start_image"]}]}]}
        n = hfd._normalizar_modelo(bruto["items"][0])
        self.assertEqual(n["duracao"]["opcoes"], [5, 10])
        self.assertEqual(n["audio"]["parametro"], "sound")
        self.assertEqual(n["midias"], ["start_image"])

    def test_retrato_dos_modelos_presente(self):
        cat = json.loads((RAIZ / "data/modelos.json").read_text())
        self.assertGreaterEqual(len(cat["modelos"]), 100)
        self.assertRegex(cat["gerado_em"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn("cinematic_studio_video_4_0", cat["modelos"])

    def test_modelos_de_exemplo_validam_no_retrato_real(self):
        for nome in ("projeto.json", "i2v.json"):
            p = json.loads((RAIZ / "templates" / nome).read_text())
            self.assertEqual(hfd.validar(p)["erros"], [], nome)

    def test_cli_codigos_de_saida(self):
        with tempfile.TemporaryDirectory() as d:
            ruim = Path(d) / "p.json"
            ruim.write_text(json.dumps({"tomadas": []}))
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(hfd.main(["validar", str(ruim)]), 1)
                self.assertEqual(hfd.main(["validar", str(ruim) + "x"]), 2)
                self.assertEqual(hfd.main(["otica", "50", "4"]), 0)


class Skill(unittest.TestCase):
    def setUp(self):
        self.txt = (RAIZ / "SKILL.md").read_text(encoding="utf-8")

    def test_frontmatter(self):
        m = re.match(r"^---\nname: ([a-z0-9-]+)\ndescription: (.+?)\n---\n", self.txt, re.S)
        self.assertTrue(m, "frontmatter com name e description")
        self.assertEqual(m.group(1), "higgsfield-director")
        self.assertLessEqual(len(m.group(2)), 1024)

    def test_rc3_todo_caminho_citado_existe(self):
        textos = [self.txt] + [p.read_text(encoding="utf-8") for p in (RAIZ / "references").glob("*.md")]
        citados = set()
        for t in textos:
            citados |= set(re.findall(r"`((?:references|scripts|templates|data)/[\w./-]+)`", t))
        self.assertTrue(citados)
        faltando = [c for c in citados if not (RAIZ / c).exists()]
        self.assertEqual(faltando, [])

    def test_tamanho_do_skill_md(self):
        self.assertLessEqual(len(self.txt.splitlines()), 200)


if __name__ == "__main__":
    unittest.main()
