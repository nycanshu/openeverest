// Copyright (C) 2026 The OpenEverest Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocation,
  useMatch,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, CircularProgress, Paper, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from 'react-hook-form';
import { ZodType } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Provider } from 'shared-types/api.types';
import { useProviders } from 'hooks/api/providers/useProviders';
import {
  INSTANCE_PRESETS_QUERY_KEY,
  useCreateInstancePreset,
  useInstancePreset,
  useInstancePresets,
  useUpdateInstancePreset,
} from 'hooks/api/instance-presets';
import { preprocessSchema } from 'components/ui-generator/utils/preprocess/preprocess-schema';
import { applyPresetOverridesToUiSchema } from 'components/ui-generator/utils/preprocess/apply-preset-overrides';
import { getDefaultValues } from 'components/ui-generator/utils/default-values';
import { extractInstanceValues } from 'components/ui-generator/utils/default-values/extract-instance-values';
import { mergeTopologyDefaults } from 'components/ui-generator/utils/default-values/merge-topology-defaults';
import {
  StepDefinition,
  useErrorRouting,
  useFormEngine,
  useStepNavigation,
} from 'components/ui-generator/form-engine';
import { ComponentErrorBoundary } from 'components/ui-generator/component-error-boundary';
import { FormMode } from 'components/ui-generator/ui-generator.types';
import { StepHeader } from 'pages/database-form/database-form-body/steps-old/step-header/step-header';
import { PresetBaseStep } from './preset-base-step';
import { PresetFormProvider } from './preset-form-context';
import {
  PresetFormFields,
  PresetFormValues,
  PresetPageMode,
} from './preset-form.types';
import { buildPresetSpec } from './build-preset-spec';
import { getPresetValidationSchema } from './preset-form-schema';
import { Messages } from './preset-form.messages';

const BASE_STEP_ID = 'preset-base';

type PresetFormInnerProps = {
  mode: PresetPageMode;
  providers: Provider[];
  initialPreset?: PresetFormValues;
  initialProviderName: string;
  existingNames: string[];
};

const PresetFormInner = ({
  mode,
  providers,
  initialPreset,
  initialProviderName,
  existingNames,
}: PresetFormInnerProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityLocked = mode !== PresetPageMode.Create;
  const isView = mode === PresetPageMode.View;

  const { mutate: createPreset, isPending: isCreating } =
    useCreateInstancePreset();
  const { mutate: updatePreset, isPending: isUpdating } =
    useUpdateInstancePreset();

  const [selectedProviderName, setSelectedProviderName] =
    useState(initialProviderName);

  const selectedProvider = useMemo(
    () =>
      providers.find((p) => p.metadata?.name === selectedProviderName) ??
      providers[0],
    [providers, selectedProviderName]
  );

  // Preprocess the provider schema and relax it for Instance Presets so that
  // both rendering and Zod validation drop namespace-scoped requirements and
  // allow an empty (cluster-default) StorageClass.
  const uiSchema = useMemo(
    () =>
      applyPresetOverridesToUiSchema(
        preprocessSchema(
          selectedProvider?.spec?.uiSchema || {},
          selectedProvider
        )
      ),
    [selectedProvider]
  );

  const topologies = useMemo(() => Object.keys(uiSchema), [uiSchema]);
  const hasMultipleTopologies = topologies.length > 1;

  const initialTopology = useMemo(() => {
    const presetTopology = (
      initialPreset?.topology as { type?: string } | undefined
    )?.type;
    return presetTopology || topologies[0] || '';
  }, [initialPreset, topologies]);

  // Default values are computed once for the initial mount. Provider/topology
  // switches (create mode only) are handled by the reset effects below.
  const defaultValues = useMemo(() => {
    const schemaDefaults = getDefaultValues(uiSchema, initialTopology);

    if (mode === PresetPageMode.Create) {
      return {
        ...schemaDefaults,
        [PresetFormFields.presetName]: '',
        provider: selectedProviderName,
        topology: { type: initialTopology },
      } as PresetFormValues;
    }

    const sections = uiSchema[initialTopology]?.sections ?? {};
    const extracted = extractInstanceValues(
      sections,
      (initialPreset ?? {}) as Record<string, unknown>,
      FormMode.Preset
    );

    return {
      ...schemaDefaults,
      ...extracted,
      [PresetFormFields.presetName]: initialPreset?.presetName ?? '',
      provider: selectedProviderName,
      topology: { type: initialTopology },
    } as PresetFormValues;
    // Only compute on first mount for the initial provider/topology.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validationSchemaRef = useRef<ZodType<PresetFormValues> | null>(null);

  const methods = useForm<PresetFormValues>({
    mode: 'onChange',
    resolver: (data, context, options) => {
      if (!validationSchemaRef.current) {
        return { values: data, errors: {} };
      }
      return zodResolver(validationSchemaRef.current, undefined, {
        mode: 'sync',
      })(data, context, options);
    },
    // @ts-ignore
    defaultValues,
  });

  const {
    control,
    reset,
    getValues,
    trigger,
    clearErrors,
    handleSubmit,
    formState: { errors, isValid },
  } = methods;

  const watchedProvider = useWatch({ control, name: 'provider' });
  const selectedTopology = useWatch({
    control,
    name: PresetFormFields.topology,
  });

  // Keep selectedProviderName in sync with the form (create mode only).
  useEffect(() => {
    if (
      mode === PresetPageMode.Create &&
      typeof watchedProvider === 'string' &&
      watchedProvider &&
      watchedProvider !== selectedProviderName
    ) {
      setSelectedProviderName(watchedProvider);
    }
  }, [watchedProvider, selectedProviderName, mode]);

  const staticSteps = useMemo(
    (): StepDefinition[] => [
      {
        id: BASE_STEP_ID,
        label: Messages.baseStep.title,
        component: PresetBaseStep,
        fields: [
          PresetFormFields.presetName,
          PresetFormFields.provider,
          PresetFormFields.topology,
        ],
      },
    ],
    []
  );

  const engine = useFormEngine({
    uiSchema,
    selectedTopology: selectedTopology || initialTopology,
    staticSteps,
    providerObject: selectedProvider,
    formMode: FormMode.Preset,
  });

  const nav = useStepNavigation(engine.steps, BASE_STEP_ID);

  const validStepIds = useMemo(
    () => new Set(engine.steps.map((s) => s.id)),
    [engine.steps]
  );
  const stepsWithErrors = useErrorRouting(
    errors,
    engine.fieldToStepMap,
    validStepIds
  );

  const validationSchema = useMemo(
    () =>
      getPresetValidationSchema(
        mode === PresetPageMode.Create ? existingNames : [],
        engine.zodSchema
      ) as unknown as ZodType<PresetFormValues>,
    [existingNames, engine.zodSchema, mode]
  );

  useEffect(() => {
    validationSchemaRef.current = validationSchema;
    trigger();
  }, [validationSchema, trigger]);

  // Provider switch (create mode) — reset to the new provider's schema defaults.
  const prevProviderRef = useRef<string>(selectedProviderName);
  useEffect(() => {
    if (mode !== PresetPageMode.Create) return;
    if (prevProviderRef.current === selectedProviderName) return;
    prevProviderRef.current = selectedProviderName;

    const topology = topologies[0] || '';
    const schemaDefaults = getDefaultValues(uiSchema, topology);
    reset({
      ...schemaDefaults,
      [PresetFormFields.presetName]: getValues(PresetFormFields.presetName),
      provider: selectedProviderName,
      topology: { type: topology },
    } as PresetFormValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviderName, uiSchema]);

  // Topology switch — merge new topology defaults into existing values.
  const prevTopologyRef = useRef<string | undefined>(initialTopology);
  useEffect(() => {
    const topologyType = selectedTopology;
    if (!topologyType) return;
    if (prevTopologyRef.current === undefined) {
      prevTopologyRef.current = topologyType;
      return;
    }
    if (topologyType === prevTopologyRef.current) return;
    prevTopologyRef.current = topologyType;

    const topologyDefaults = getDefaultValues(uiSchema, topologyType);
    const merged = mergeTopologyDefaults(
      getValues() as Record<string, unknown>,
      topologyDefaults
    );
    reset(merged as PresetFormValues, { keepDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopology, uiSchema]);

  useEffect(() => {
    trigger();
  }, [nav.activeStepId, trigger]);

  const onSubmit: SubmitHandler<PresetFormValues> = (data) => {
    if (isView) return;

    const postProcessed = engine.postprocess(
      data as Record<string, unknown>
    ) as PresetFormValues;
    const spec = buildPresetSpec(postProcessed);
    const name = (data.presetName as string) || '';

    const onSuccess = () => {
      queryClient.invalidateQueries({
        queryKey: [INSTANCE_PRESETS_QUERY_KEY],
      });
      navigate('/instance-presets');
    };

    if (mode === PresetPageMode.Create) {
      createPreset({ name, spec }, { onSuccess });
    } else {
      updatePreset({ name, spec }, { onSuccess });
    }
  };

  const activeStep = nav.activeStepIndex;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === engine.steps.length - 1;
  const currentStep = engine.steps[activeStep];
  const StepComponent = currentStep?.component;
  const isSubmitting = isCreating || isUpdating;

  const submitLabel =
    mode === PresetPageMode.Create
      ? Messages.buttons.create
      : Messages.buttons.save;

  const pageTitle =
    mode === PresetPageMode.Create
      ? Messages.createTitle
      : mode === PresetPageMode.Edit
        ? Messages.editTitle
        : Messages.viewTitle;

  return (
    <PresetFormProvider
      value={{
        mode,
        providers,
        topologies,
        hasMultipleTopologies,
        identityLocked,
      }}
    >
      <FormProvider {...methods}>
        <Box sx={{ maxWidth: 760 }}>
          <StepHeader pageTitle={pageTitle} />
          <Paper
            variant="outlined"
            elevation={0}
            sx={{ mt: 3, p: 3, borderRadius: 1 }}
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {activeStep > 0 && currentStep?.sectionKey && (
                <StepHeader
                  pageTitle={currentStep.label}
                  pageDescription={currentStep.description || ''}
                />
              )}
              {/*
                The fieldset is disabled in view mode to make every nested
                input read-only. Navigation buttons live OUTSIDE it so they
                stay interactive.
              */}
              <fieldset
                disabled={isView}
                style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}
              >
                {StepComponent && (
                  <ComponentErrorBoundary
                    key={currentStep?.id}
                    componentName={currentStep?.label || 'this step'}
                  >
                    <StepComponent loadingDefaultsForEdition={false} />
                  </ComponentErrorBoundary>
                )}
              </fieldset>
              <Stack direction="row" sx={{ pt: 4 }}>
                {!isFirstStep && (
                  <Button
                    type="button"
                    startIcon={<ArrowBackIcon />}
                    variant="text"
                    onClick={() => {
                      clearErrors();
                      nav.back();
                    }}
                    sx={{ mr: 1 }}
                    data-testid="preset-previous-button"
                  >
                    {Messages.buttons.previous}
                  </Button>
                )}
                <Box sx={{ flex: '1 1 auto' }} />
                <Button
                  type="button"
                  variant="outlined"
                  sx={{ mr: 1 }}
                  onClick={() => navigate('/instance-presets')}
                  data-testid="preset-cancel-button"
                >
                  {isView ? Messages.buttons.close : Messages.buttons.cancel}
                </Button>
                {!isView && isLastStep ? (
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting || !isValid}
                    data-testid="preset-submit-button"
                  >
                    {submitLabel}
                  </Button>
                ) : !isLastStep ? (
                  <Button
                    type="button"
                    variant="contained"
                    onClick={() => nav.next()}
                    disabled={stepsWithErrors.includes(nav.activeStepId)}
                    data-testid="preset-continue-button"
                  >
                    {Messages.buttons.continue}
                  </Button>
                ) : null}
              </Stack>
            </form>
          </Paper>
        </Box>
      </FormProvider>
    </PresetFormProvider>
  );
};

export const InstancePresetFormPage = () => {
  const { name } = useParams<{ name: string }>();
  const location = useLocation();
  const editMatch = useMatch('/instance-presets/:name/edit');

  const mode: PresetPageMode = !name
    ? PresetPageMode.Create
    : editMatch
      ? PresetPageMode.Edit
      : PresetPageMode.View;

  const needsPreset = mode !== PresetPageMode.Create;

  const { data: providers = [], isLoading: providersLoading } = useProviders();
  const { data: preset, isLoading: presetLoading } = useInstancePreset(
    name ?? '',
    { enabled: needsPreset }
  );
  const { data: allPresets = [] } = useInstancePresets();

  const stateProviderName = (
    location.state as { selectedDbProvider?: Provider } | null
  )?.selectedDbProvider?.metadata?.name;

  if (providersLoading || (needsPreset && presetLoading)) {
    return (
      <Stack alignItems="center" sx={{ mt: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const initialProviderName =
    mode === PresetPageMode.Create
      ? (stateProviderName ?? providers[0]?.metadata?.name ?? '')
      : ((preset?.spec?.provider as string) ??
        providers[0]?.metadata?.name ??
        '');

  const initialPreset: PresetFormValues | undefined = preset
    ? {
        presetName: preset.metadata?.name ?? name ?? '',
        provider: (preset.spec?.provider as string) ?? '',
        topology: preset.spec?.topology as { type?: string } | undefined,
        spec: preset.spec as Record<string, unknown>,
      }
    : undefined;

  const existingNames = allPresets
    .map((p) => p.metadata?.name ?? '')
    .filter(Boolean);

  return (
    <PresetFormInner
      mode={mode}
      providers={providers}
      initialPreset={initialPreset}
      initialProviderName={initialProviderName}
      existingNames={existingNames}
    />
  );
};

export default InstancePresetFormPage;
