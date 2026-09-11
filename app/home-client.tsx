'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  BatteryCharging,
  CircleDollarSign,
  Fuel,
  Gauge,
  Info,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Powertrain = 'gas' | 'diesel' | 'electric';
type Vehicle = {
  id: number;
  name: string;
  powertrain: Powertrain;
  efficiency: number;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: Record<string, unknown>;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const starterVehicles: Vehicle[] = [
  { id: 1, name: 'Gas truck', powertrain: 'gas', efficiency: 19 },
  { id: 2, name: 'Diesel truck', powertrain: 'diesel', efficiency: 24 },
  { id: 3, name: 'Electric truck', powertrain: 'electric', efficiency: 2.1 },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat('en-US');
const MIN_EFFICIENCY = 0.1;
const powertrainIcon = (powertrain: Powertrain) =>
  powertrain === 'electric' ? BatteryCharging : Fuel;
const powertrainColor = (powertrain: Powertrain) =>
  powertrain === 'electric'
    ? 'electric'
    : powertrain === 'diesel'
      ? 'diesel'
      : 'gas';

export default function HomeClient() {
  const [vehicles, setVehicles] = useState(starterVehicles);
  const [milesEachWay, setMilesEachWay] = useState(100);
  const [trailerWeight, setTrailerWeight] = useState(6000);
  const [campgroundCharging, setCampgroundCharging] = useState(false);
  const [gasPrice, setGasPrice] = useState(3.4);
  const [dieselPrice, setDieselPrice] = useState(3.85);
  const [electricityPrice, setElectricityPrice] = useState(0.16);

  const roundTripMiles = milesEachWay * 2;

  const comparisons = useMemo(
    () =>
      vehicles
        .map((vehicle) => {
          // One shared trailer load is used for every vehicle. The load adjusts
          // efficiency without asking the user for a separate tow rating per vehicle.
          const towRatio = trailerWeight / 10000;
          const towingPenalty = vehicle.powertrain === 'electric' ? 0.8 : 0.52;
          const tripEfficiency =
            Math.max(MIN_EFFICIENCY, vehicle.efficiency) /
            (1 + Math.max(0, towRatio) * towingPenalty);
          const energyPrice =
            vehicle.powertrain === 'gas'
              ? gasPrice
              : vehicle.powertrain === 'diesel'
                ? dieselPrice
                : electricityPrice;
          const totalEnergyUsed = roundTripMiles / tripEfficiency;
          const paidMiles =
            vehicle.powertrain === 'electric' && campgroundCharging
              ? milesEachWay
              : roundTripMiles;
          const paidEnergyUsed = paidMiles / tripEfficiency;
          const tripCost = paidEnergyUsed * energyPrice;
          return {
            ...vehicle,
            tripEfficiency,
            totalEnergyUsed,
            paidEnergyUsed,
            tripCost,
            freeReturnCharge:
              vehicle.powertrain === 'electric' && campgroundCharging,
          };
        })
        .sort((a, b) => a.tripCost - b.tripCost),
    [
      campgroundCharging,
      dieselPrice,
      electricityPrice,
      gasPrice,
      milesEachWay,
      roundTripMiles,
      trailerWeight,
      vehicles,
    ],
  );

  const lowestCost = comparisons[0]?.tripCost ?? 0;
  const highestCost = comparisons[comparisons.length - 1]?.tripCost ?? 0;
  const lowestCostCount = comparisons.filter(
    (vehicle) => Math.abs(vehicle.tripCost - lowestCost) < 0.005,
  ).length;

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'set_trip_assumptions',
            title: 'Set trip assumptions',
            description:
              'Update miles each way, trailer weight, or campground charging used in the visible round-trip comparison.',
            inputSchema: {
              type: 'object',
              properties: {
                milesEachWay: { type: 'number', minimum: 0 },
                trailerWeightLb: { type: 'number', minimum: 0, maximum: 20000 },
                campgroundCharging: { type: 'boolean' },
              },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (!input || typeof input !== 'object')
                throw new Error('Trip assumptions must be an object.');
              const values = input as Record<string, unknown>;
              for (const [key, setter, maximum] of [
                ['milesEachWay', setMilesEachWay, undefined],
                ['trailerWeightLb', setTrailerWeight, 20000],
              ] as const) {
                if (values[key] === undefined) continue;
                if (
                  typeof values[key] !== 'number' ||
                  !Number.isFinite(values[key]) ||
                  values[key] < 0 ||
                  (maximum !== undefined && values[key] > maximum)
                )
                  throw new Error(`Invalid ${key}.`);
                setter(values[key]);
              }
              if (values.campgroundCharging !== undefined) {
                if (typeof values.campgroundCharging !== 'boolean')
                  throw new Error('Invalid campgroundCharging.');
                setCampgroundCharging(values.campgroundCharging);
              }
              return { updated: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);

      void Promise.resolve(
        context.registerTool(
          {
            name: 'get_trip_cost_comparison',
            title: 'Get trip cost comparison',
            description:
              'Return the current visible energy cost estimate for every vehicle on this trip.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute() {
              return {
                milesEachWay,
                roundTripMiles,
                trailerWeightLb: trailerWeight,
                campgroundCharging,
                vehicles: comparisons.map((vehicle) => ({
                  name: vehicle.name,
                  powertrain: vehicle.powertrain,
                  tripCost: Number(vehicle.tripCost.toFixed(2)),
                  paidEnergyUsed: Number(vehicle.paidEnergyUsed.toFixed(2)),
                  freeReturnCharge: vehicle.freeReturnCharge,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // WebMCP is optional for browsers that do not support it.
    }
    return () => lifecycle.abort();
  }, [
    campgroundCharging,
    comparisons,
    milesEachWay,
    roundTripMiles,
    trailerWeight,
  ]);

  function updateVehicle<K extends keyof Vehicle>(
    id: number,
    key: K,
    value: Vehicle[K],
  ) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, [key]: value } : vehicle,
      ),
    );
  }

  function addVehicle() {
    setVehicles((current) => [
      ...current,
      {
        id: Date.now(),
        name: `Vehicle ${current.length + 1}`,
        powertrain: 'gas',
        efficiency: 24,
      },
    ]);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f5] text-[#17201d]">
      <header className="border-b border-[#dce4de] bg-[#fbfdfb]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#173d31] text-[#d9f68a] shadow-sm">
              <Gauge size={22} strokeWidth={2.3} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Drive Cost</h1>
              <p className="text-xs font-medium text-[#607066]">
                Single-trip vehicle comparison
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#516159] sm:flex">
            <Info size={16} /> Energy cost estimate only
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <section className="mb-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-2xl bg-[#173d31] p-6 text-white shadow-[0_12px_35px_rgba(23,61,49,0.14)] sm:p-7">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#d9f68a]">
              Plan one trip
            </p>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Which vehicle costs the least for this drive?
            </h2>
            <p className="mt-3 max-w-2xl text-[0.98rem] leading-6 text-[#d9e5dd]">
              Enter your route distance, energy prices, and trailer load.
              Compare as many gas, diesel, or electric vehicles as you want.
            </p>
          </div>
          <section
            aria-labelledby="prices-title"
            className="rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <CircleDollarSign className="text-[#38735c]" size={20} />
              <h2 id="prices-title" className="font-bold">
                Energy prices
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Gas / gal"
                value={gasPrice}
                step="0.01"
                prefix="$"
                onChange={setGasPrice}
              />
              <NumberField
                label="Diesel / gal"
                value={dieselPrice}
                step="0.01"
                prefix="$"
                onChange={setDieselPrice}
              />
              <NumberField
                label="Electric / kWh"
                value={electricityPrice}
                step="0.01"
                prefix="$"
                onChange={setElectricityPrice}
              />
            </div>
          </section>
        </section>

        <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="contents min-w-0 xl:block">
            <section
              aria-labelledby="vehicles-title"
              className="rounded-2xl border border-[#dce4de] bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ece7] px-5 py-4 sm:px-6">
                <div>
                  <h2
                    id="vehicles-title"
                    className="text-xl font-bold tracking-tight"
                  >
                    Your vehicles
                  </h2>
                  <p className="mt-0.5 text-sm text-[#647268]">
                    Add each option&apos;s powertrain and efficiency.
                  </p>
                </div>
                <Button
                  onClick={addVehicle}
                  className="bg-[#173d31] px-3 hover:bg-[#285745]"
                >
                  <Plus /> Add vehicle
                </Button>
              </div>
              <div className="divide-y divide-[#e6ece7]">
                {vehicles.map((vehicle) => {
                  const Icon = powertrainIcon(vehicle.powertrain);
                  const powertrainId = `vehicle-${vehicle.id}-powertrain`;
                  return (
                    <article key={vehicle.id} className="p-5 sm:p-6">
                      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div
                            className={`powertrain-icon ${powertrainColor(vehicle.powertrain)}`}
                          >
                            <Icon size={19} />
                          </div>
                          <Input
                            aria-label="Vehicle name"
                            value={vehicle.name}
                            onChange={(event) =>
                              updateVehicle(
                                vehicle.id,
                                'name',
                                event.target.value,
                              )
                            }
                            className="h-9 w-full max-w-[225px] border-transparent bg-transparent px-1 text-base font-bold shadow-none focus-visible:border-[#8fb7a4]"
                          />
                        </div>
                        {vehicles.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${vehicle.name}`}
                            onClick={() =>
                              setVehicles((current) =>
                                current.filter(
                                  (item) => item.id !== vehicle.id,
                                ),
                              )
                            }
                            className="shrink-0 text-[#7a3e3e] hover:bg-[#fff0ee] hover:text-[#7a3e3e]"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={powertrainId} className="field-label">
                            Powertrain
                          </label>
                          <Select
                            value={vehicle.powertrain}
                            onValueChange={(value) =>
                              updateVehicle(
                                vehicle.id,
                                'powertrain',
                                value as Powertrain,
                              )
                            }
                          >
                            <SelectTrigger
                              id={powertrainId}
                              aria-label={`${vehicle.name} powertrain`}
                              className="h-10 w-full border-[#d5dfd7] bg-[#fbfdfb]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectItem value="gas">Gas</SelectItem>
                              <SelectItem value="diesel">Diesel</SelectItem>
                              <SelectItem value="electric">Electric</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <NumberField
                          label={
                            vehicle.powertrain === 'electric'
                              ? 'Miles / kWh'
                              : 'MPG'
                          }
                          value={vehicle.efficiency}
                          min={String(MIN_EFFICIENCY)}
                          step="0.1"
                          onChange={(value) =>
                            updateVehicle(vehicle.id, 'efficiency', value)
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section
              aria-labelledby="results-title"
              className="order-3 mt-0 min-w-0 overflow-hidden rounded-2xl border border-[#dce4de] bg-white shadow-sm xl:mt-7"
            >
              <div className="border-b border-[#e6ece7] px-5 py-4 sm:px-6">
                <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#5b9479]">
                  {number.format(roundTripMiles)}-mile round trip ·{' '}
                  {number.format(milesEachWay)} miles each way
                </p>
                <h2
                  id="results-title"
                  className="text-xl font-bold tracking-tight"
                >
                  Energy cost comparison
                </h2>
              </div>
              <div className="divide-y divide-[#e6ece7]">
                {comparisons.map((vehicle) => {
                  const Icon = powertrainIcon(vehicle.powertrain);
                  const difference = vehicle.tripCost - lowestCost;
                  const width =
                    highestCost === lowestCost
                      ? 100
                      : 45 +
                        ((vehicle.tripCost - lowestCost) /
                          (highestCost - lowestCost)) *
                          55;
                  const isLowest =
                    Math.abs(vehicle.tripCost - lowestCost) < 0.005;
                  const isTiedLowest = isLowest && lowestCostCount > 1;
                  return (
                    <div
                      key={vehicle.id}
                      className="grid min-w-0 gap-4 p-5 sm:grid-cols-[minmax(175px,0.7fr)_minmax(180px,1fr)_auto] sm:items-center sm:px-6"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            className={`mini-icon ${powertrainColor(vehicle.powertrain)}`}
                          >
                            <Icon size={15} />
                          </span>
                          <span className="min-w-0 break-words font-bold">
                            {vehicle.name}
                          </span>
                          {isLowest && (
                            <span className="best-badge shrink-0">
                              {isTiedLowest ? 'Tied lowest' : 'Lowest'}
                            </span>
                          )}
                        </div>
                        {vehicle.freeReturnCharge && (
                          <p className="mt-1 text-xs font-semibold text-[#397b5e]">
                            Return charging included at campground
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1.5 h-2.5 overflow-hidden rounded-full bg-[#e9efeb]">
                          <div
                            className={`cost-bar ${powertrainColor(vehicle.powertrain)}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#68786d]">
                          {isLowest
                            ? isTiedLowest
                              ? 'Tied for least expensive energy estimate'
                              : 'Least expensive energy estimate'
                            : `${money.format(difference)} more for this trip`}
                        </p>
                      </div>
                      <div className="min-w-0 sm:text-right">
                        <p className="break-words text-2xl font-extrabold tracking-tight">
                          {money.format(vehicle.tripCost)}
                        </p>
                        <p className="text-xs text-[#68786d]">
                          {money.format(
                            vehicle.tripCost / Math.max(roundTripMiles, 1),
                          )}{' '}
                          / mile
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="order-2 space-y-5 xl:order-none xl:sticky xl:top-5 xl:self-start">
            <section
              aria-labelledby="trip-title"
              className="rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center gap-2">
                <Gauge className="text-[#38735c]" size={20} />
                <h2 id="trip-title" className="font-bold">
                  Trip distance
                </h2>
              </div>
              <NumberField
                label="Miles each way"
                value={milesEachWay}
                onChange={setMilesEachWay}
              />
              <div className="mt-4 rounded-xl bg-[#eff5f0] p-3 text-sm text-[#4c6253]">
                <span className="font-bold text-[#173d31]">
                  {number.format(roundTripMiles)} miles round trip
                </span>
                <br />
                {number.format(milesEachWay)} miles there and{' '}
                {number.format(milesEachWay)} miles back
              </div>
            </section>
            <section
              aria-labelledby="towing-title"
              className="rounded-2xl border border-[#cde1d2] bg-[#f8fcf8] p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Truck className="text-[#38735c]" size={21} />
                <h2 id="towing-title" className="font-bold">
                  Shared towing load
                </h2>
              </div>
              <p className="mb-5 text-sm leading-5 text-[#607066]">
                This one trailer weight is applied to every vehicle for the full
                trip. Set it to 0 if you are not towing.
              </p>
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <span className="field-label mb-0">Trailer weight</span>
                  <span className="text-xl font-extrabold text-[#173d31]">
                    {number.format(trailerWeight)} lb
                  </span>
                </div>
                <Slider
                  aria-label="Trailer weight"
                  value={[trailerWeight]}
                  min={0}
                  max={20000}
                  step={250}
                  onValueChange={(value) =>
                    setTrailerWeight(
                      Array.isArray(value) ? (value[0] ?? 0) : value,
                    )
                  }
                  className="tow-slider"
                />
                <div className="mt-2 flex justify-between text-xs text-[#718078]">
                  <span>0 lb</span>
                  <span>20,000 lb</span>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[#d7e8da] bg-white p-3 text-xs leading-5 text-[#55705d]">
                The shared load changes estimated fuel economy and electric
                range; it is not a manufacturer range guarantee.
              </div>
            </section>
            <section
              aria-labelledby="charging-title"
              className="rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm"
            >
              <h2 id="charging-title" className="font-bold">
                Campground charging
              </h2>
              <label
                htmlFor="campground-charging"
                className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-[#eff5f0] p-3 text-sm leading-5 text-[#42624d]"
              >
                <Checkbox
                  id="campground-charging"
                  checked={campgroundCharging}
                  onCheckedChange={setCampgroundCharging}
                  aria-label="Free return charging at campground"
                />
                <span>
                  <strong className="text-[#173d31]">
                    Charge at the campground
                  </strong>
                  <br />
                  For electric vehicles, the return-trip electricity is free
                  because it is included with the campsite.
                </span>
              </label>
            </section>
            <section
              aria-label="What is included"
              className="rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm"
            >
              <h2 className="font-bold">What&apos;s included</h2>
              <p className="mt-2 text-sm leading-5 text-[#607066]">
                Only the fuel or electricity needed for this trip. Purchase
                price, maintenance, insurance, and depreciation are not
                included.
              </p>
            </section>
          </aside>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {comparisons.map((vehicle) => (
            <article
              key={vehicle.id}
              className="min-w-0 rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm"
            >
              <p className="break-words text-sm font-bold">{vehicle.name}</p>
              <div className="mt-4 grid min-w-0 grid-cols-2 gap-y-3 text-sm">
                <span className="text-[#6a786f]">Total energy used</span>
                <span className="break-words text-right font-semibold">
                  {vehicle.totalEnergyUsed.toFixed(1)}{' '}
                  {vehicle.powertrain === 'electric' ? 'kWh' : 'gal'}
                </span>
                <span className="text-[#6a786f]">Energy you pay for</span>
                <span className="break-words text-right font-semibold">
                  {vehicle.paidEnergyUsed.toFixed(1)}{' '}
                  {vehicle.powertrain === 'electric' ? 'kWh' : 'gal'}
                </span>
                <span className="text-[#6a786f]">Trip efficiency</span>
                <span className="break-words text-right font-semibold">
                  {vehicle.tripEfficiency.toFixed(1)}{' '}
                  {vehicle.powertrain === 'electric' ? 'mi/kWh' : 'mpg'}
                </span>
                <span className="text-[#6a786f]">Energy cost</span>
                <span className="break-words text-right font-semibold">
                  {money.format(vehicle.tripCost)}
                </span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = '1',
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  const inputId = useId();
  const minimum = Number(min ?? '0');
  const maximum = max === undefined ? Number.POSITIVE_INFINITY : Number(max);
  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className="relative">
        {prefix && <span className="input-affix left-3">{prefix}</span>}
        <Input
          id={inputId}
          type="number"
          value={Number.isFinite(value) ? value : minimum}
          min={minimum}
          max={max}
          step={step}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            onChange(
              Math.min(
                maximum,
                Math.max(
                  minimum,
                  Number.isFinite(nextValue) ? nextValue : minimum,
                ),
              ),
            );
          }}
          className={`h-10 border-[#d5dfd7] bg-[#fbfdfb] font-semibold tabular-nums focus-visible:border-[#4e9270] ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && <span className="input-affix right-3">{suffix}</span>}
      </div>
    </div>
  );
}
