import {
  EMPTY_FILTER,
  getCountryOptions,
  getDistrictOptions,
  getFilterSummary,
  getProvinceOptions,
  getRegionOptions,
  isAmazonasRegion,
} from '../../lib/placeCatalog'
import Button from '../ui/Button'
import EditorSelect from '../ui/EditorSelect'

export default function EditorSidebar({
  places,
  filter,
  onChange,
  catalogReady,
  uploadPlace,
  uploadLoading,
  onUploadClick,
}) {
  const countries = getCountryOptions(places)
  const regions = getRegionOptions(places, filter.country)
  const provinces = getProvinceOptions(places, filter.region)
  const districts = catalogReady
    ? getDistrictOptions(places, filter.province)
    : []

  const hasFilter =
    filter.country || filter.region || filter.province || filter.district
  const summary = getFilterSummary(places, filter)

  function setCountry(slug) {
    if (!slug) onChange({ ...EMPTY_FILTER })
    else onChange({ ...EMPTY_FILTER, country: slug })
  }

  function setRegion(slug) {
    onChange({ ...filter, region: slug, province: null, district: null })
  }

  function setProvince(slug) {
    onChange({ ...filter, province: slug, district: null })
  }

  function setDistrict(slug) {
    onChange({ ...filter, district: slug })
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/[0.06] bg-[#111113] lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-white/[0.06] px-4 py-4 lg:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Ubicación
        </p>
        <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-100">
          {summary}
        </p>
      </div>

      <div className="editor-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 lg:px-5">
        <EditorSelect
          label="País"
          placeholder="Todos los lugares"
          value={filter.country}
          options={countries}
          onChange={setCountry}
        />

        {filter.country && (
          <EditorSelect
            label="Región"
            placeholder="Todas las regiones"
            value={filter.region}
            options={regions}
            onChange={setRegion}
          />
        )}

        {filter.region && isAmazonasRegion(filter.region) && (
          <EditorSelect
            label="Provincia"
            placeholder="Todas las provincias"
            value={filter.province}
            options={provinces}
            onChange={setProvince}
          />
        )}

        {filter.province && (
          <EditorSelect
            label="Distrito"
            placeholder="Todos los distritos"
            value={filter.district}
            options={districts}
            onChange={setDistrict}
            disabled={!districts.length}
          />
        )}

        {!filter.country && (
          <p className="rounded-lg bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200/80 ring-1 ring-amber-400/20">
            Vista global · Elige Perú y una región para filtrar o subir fotos.
          </p>
        )}
      </div>

      <div className="mt-auto space-y-2 border-t border-white/[0.06] p-4 lg:p-5">
        {uploadPlace && (
          <Button
            variant="primary"
            size="lg"
            className="w-full lg:hidden"
            onClick={onUploadClick}
            disabled={uploadLoading}
          >
            {uploadLoading ? 'Subiendo…' : `Subir a ${uploadPlace.name}`}
          </Button>
        )}
        {hasFilter && (
          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={() => onChange({ ...EMPTY_FILTER })}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </aside>
  )
}
